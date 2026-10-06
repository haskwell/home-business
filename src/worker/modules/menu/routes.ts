import { Hono } from "hono";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import { getDB } from "../../db/client";
import { categories, items } from "../../db/schema";

const createItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().int().nonnegative(), // smallest unit, e.g. 2500 = 25.00
  categoryId: z.number().int().positive().optional(),
  image: z.string().optional(),
  inStock: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const updateItemSchema = createItemSchema
  .partial()
  .extend({ categoryId: z.number().int().positive().nullable().optional() })
  .refine((d) => Object.keys(d).length > 0, "Send at least one field");

const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

const menu = new Hono<AppEnv>();

menu.use("*", requireAuth, async (c, next) => {
  if (!c.get("user").businessId) {
    return c.json({ error: "No business linked to this account" }, 403);
  }
  await next();
});

// Used by both create and edit, so it's a local helper in this file.
async function categoryBelongsToBusiness(
  db: ReturnType<typeof getDB>,
  categoryId: number,
  businessId: number,
) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.businessId, businessId)));
  return !!row;
}

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Same name (ignoring upper/lower case) twice in one business is blocked.
// excludeId lets a category keep its own name when it is edited.
async function categoryNameTaken(
  db: ReturnType<typeof getDB>,
  businessId: number,
  name: string,
  excludeId?: number,
) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.businessId, businessId),
        sql`lower(${categories.name}) = lower(${name})`,
        excludeId ? ne(categories.id, excludeId) : undefined,
      ),
    );
  return !!row;
}

// LIST (own items, including unlisted) - needed so the test page can show ids
menu.get("/items", async (c) => {
  const db = getDB(c.env);
  const rows = await db
    .select()
    .from(items)
    .where(eq(items.businessId, c.get("user").businessId!))
    .orderBy(desc(items.priority), asc(items.id));
  return c.json({ items: rows });
});

// CREATE
menu.post("/items", zValidator("json", createItemSchema), async (c) => {
  const businessId = c.get("user").businessId!;
  const input = c.req.valid("json");
  const db = getDB(c.env);

  if (input.categoryId && !(await categoryBelongsToBusiness(db, input.categoryId, businessId))) {
    return c.json({ error: "Category not found" }, 400);
  }

  const [item] = await db.insert(items).values({ ...input, businessId }).returning();
  return c.json({ item }, 201);
});

// EDIT
menu.patch("/items/:id", zValidator("json", updateItemSchema), async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);

  const businessId = c.get("user").businessId!;
  const input = c.req.valid("json");
  const db = getDB(c.env);

  if (input.categoryId && !(await categoryBelongsToBusiness(db, input.categoryId, businessId))) {
    return c.json({ error: "Category not found" }, 400);
  }

  const [item] = await db
    .update(items)
    .set(input)
    .where(and(eq(items.id, id), eq(items.businessId, businessId)))
    .returning();

  if (!item) return c.json({ error: "Item not found" }, 404);
  return c.json({ item });
});

// UNLIST
menu.patch("/items/:id/unlist", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);

  const db = getDB(c.env);
  const [item] = await db
    .update(items)
    .set({ isListed: false })
    .where(and(eq(items.id, id), eq(items.businessId, c.get("user").businessId!)))
    .returning();

  if (!item) return c.json({ error: "Item not found" }, 404);
  return c.json({ item });
});

// LIST CATEGORIES
menu.get("/categories", async (c) => {
  const db = getDB(c.env);
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.businessId, c.get("user").businessId!))
    .orderBy(asc(categories.name));
  return c.json({ categories: rows });
});

// CREATE CATEGORY
menu.post("/categories", zValidator("json", categorySchema), async (c) => {
  const businessId = c.get("user").businessId!;
  const { name } = c.req.valid("json");
  const db = getDB(c.env);

  if (await categoryNameTaken(db, businessId, name)) {
    return c.json({ error: "Category name already exists" }, 409);
  }

  const [category] = await db.insert(categories).values({ name, businessId }).returning();
  return c.json({ category }, 201);
});

// EDIT CATEGORY (rename)
menu.patch("/categories/:id", zValidator("json", categorySchema), async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);

  const businessId = c.get("user").businessId!;
  const { name } = c.req.valid("json");
  const db = getDB(c.env);

  if (await categoryNameTaken(db, businessId, name, id)) {
    return c.json({ error: "Category name already exists" }, 409);
  }

  const [category] = await db
    .update(categories)
    .set({ name })
    .where(and(eq(categories.id, id), eq(categories.businessId, businessId)))
    .returning();

  if (!category) return c.json({ error: "Category not found" }, 404);
  return c.json({ category });
});

// REMOVE CATEGORY
// Items in it are NOT deleted: they become uncategorized (categoryId = null).
// Both steps run in one db.batch so it is all-or-nothing.
menu.delete("/categories/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);

  const businessId = c.get("user").businessId!;
  const db = getDB(c.env);

  if (!(await categoryBelongsToBusiness(db, id, businessId))) {
    return c.json({ error: "Category not found" }, 404);
  }

  const [uncategorized, deleted] = await db.batch([
    db
      .update(items)
      .set({ categoryId: null })
      .where(and(eq(items.categoryId, id), eq(items.businessId, businessId)))
      .returning({ id: items.id }),
    db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.businessId, businessId)))
      .returning(),
  ]);

  return c.json({ category: deleted[0], itemsUncategorized: uncategorized.length });
});

export default menu;