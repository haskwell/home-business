import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import { getDB } from "../../db/client";
import { isValidBusinessSlug } from "../../lib/slug";
import {
  createBusiness,
  getOwnedBusiness,
  getBusinessBySlug,
  isBusinessSlugAvailable,
  updateOwnedBusiness,
} from "./service";

const slug = z.string().refine(isValidBusinessSlug, "Invalid or reserved business slug");

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessLink: slug,
  description: z.string().max(2000).optional(),
  ownerContact: z.string().trim().min(1).max(100).optional(),
});

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    businessLink: slug.optional(),
    instagram: z.string().max(500).nullable().optional(),
    tiktok: z.string().max(500).nullable().optional(),
    facebook: z.string().max(500).nullable().optional(),
    ownerContact: z.string().trim().max(100).nullable().optional(),
    isAcceptingOrders: z.boolean().optional(),
    contacts: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Send at least one field");

const business = new Hono<AppEnv>();
business.use("*", requireAuth);

business.post("/", zValidator("json", createSchema), async (c) => {
  const currentUser = c.get("user");
  if (currentUser.businessId) {
    return c.json({ error: "This account already has a business" }, 409);
  }

  const input = c.req.valid("json");
  const db = getDB(c.env);
  try {
    const created = await createBusiness(db, {
      ...input,
      userId: currentUser.id,
      ownerContact: input.ownerContact ?? currentUser.number,
    });
    if (!created) {
      return c.json({ error: "This account already has a business" }, 409);
    }
    return c.json({ business: created }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique constraint/i.test(message)) {
      return c.json({ error: "Business slug is already taken" }, 409);
    }
    throw error;
  }
});

business.get("/", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "Business not found" }, 404);
  const ownBusiness = await getOwnedBusiness(getDB(c.env), businessId);
  if (!ownBusiness) return c.json({ error: "Business not found" }, 404);
  return c.json({ business: ownBusiness });
});

business.get("/slug-available", async (c) => {
  const query = z.object({ slug }).safeParse({ slug: c.req.query("slug") });
  if (!query.success) return c.json({ error: "Invalid or reserved business slug" }, 400);
  const available = await isBusinessSlugAvailable(getDB(c.env), query.data.slug);
  return c.json({ available });
});

business.patch("/", zValidator("json", patchSchema), async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "Business not found" }, 404);
  const input = c.req.valid("json");
  const db = getDB(c.env);

  if (input.businessLink) {
    const existing = await getBusinessBySlug(db, input.businessLink);
    if (existing && existing.id !== businessId) {
      return c.json({ error: "Business slug is already taken" }, 409);
    }
  }

  try {
    const updated = await updateOwnedBusiness(db, businessId, input);
    if (!updated) return c.json({ error: "Business not found" }, 404);
    return c.json({ business: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique constraint/i.test(message)) {
      return c.json({ error: "Business slug is already taken" }, 409);
    }
    throw error;
  }
});

export default business;
