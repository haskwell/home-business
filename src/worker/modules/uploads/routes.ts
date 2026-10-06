import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { getDB } from "../../db/client";
import { businesses, items } from "../../db/schema";
import { user } from "../../db/schema/auth-schema";
import {
  ImageInputError,
  imageUrl,
  isOwnedImageKey,
  readImageUpload,
} from "../../lib/image";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";

const uploads = new Hono<AppEnv>();
uploads.use("*", requireAuth);

const ITEM_IMAGE_MAX = 2 * 1024 * 1024;
const LOGO_IMAGE_MAX = 2 * 1024 * 1024;
const BANNER_IMAGE_MAX = 5 * 1024 * 1024;

function parseItemId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function newImageKey(prefix: string, extension: string) {
  return `${prefix}${crypto.randomUUID()}.${extension}`;
}

function uploadError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof ImageInputError) {
    return c.json({ error: error.message }, error.status);
  }
  throw error;
}

async function deleteOldImage(
  c: Context<AppEnv>,
  oldKey: string | null | undefined,
  expectedPrefix: string,
) {
  if (!isOwnedImageKey(oldKey, expectedPrefix)) return;
  try {
    await c.env.BUCKET.delete(oldKey!);
  } catch (error) {
    console.error("Failed to delete replaced image from R2", error);
  }
}

async function storeReplacement(
  c: Context<AppEnv>,
  key: string,
  oldKey: string | null | undefined,
  expectedPrefix: string,
  image: Awaited<ReturnType<typeof readImageUpload>>,
  update: () => Promise<boolean>,
) {
  await c.env.BUCKET.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
  });

  let updated: boolean;
  try {
    updated = await update();
  } catch (error) {
    try {
      await c.env.BUCKET.delete(key);
    } catch (cleanupError) {
      console.error("Failed to clean up unlinked image from R2", cleanupError);
    }
    throw error;
  }

  if (!updated) {
    try {
      await c.env.BUCKET.delete(key);
    } catch (cleanupError) {
      console.error("Failed to clean up unlinked image from R2", cleanupError);
    }
    return false;
  }

  await deleteOldImage(c, oldKey, expectedPrefix);
  return true;
}

uploads.post("/items/:itemId/image", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked to this account" }, 403);
  const itemId = parseItemId(c.req.param("itemId"));
  if (!itemId) return c.json({ error: "Invalid item id" }, 400);

  const db = getDB(c.env);
  const [item] = await db
    .select({ image: items.image })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.businessId, businessId)));
  if (!item) return c.json({ error: "Item not found" }, 404);

  let image: Awaited<ReturnType<typeof readImageUpload>>;
  try {
    image = await readImageUpload(c.req.raw, ITEM_IMAGE_MAX);
  } catch (error) {
    return uploadError(c, error);
  }

  const prefix = `businesses/${businessId}/items/${itemId}/`;
  const key = newImageKey(prefix, image.extension);
  const saved = await storeReplacement(c, key, item.image, prefix, image, async () => {
    const [updated] = await db
      .update(items)
      .set({ image: key })
      .where(and(eq(items.id, itemId), eq(items.businessId, businessId)))
      .returning({ id: items.id });
    return !!updated;
  });
  if (!saved) return c.json({ error: "Item not found" }, 404);
  return c.json({ image: imageUrl(key) });
});

uploads.delete("/items/:itemId/image", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked to this account" }, 403);
  const itemId = parseItemId(c.req.param("itemId"));
  if (!itemId) return c.json({ error: "Invalid item id" }, 400);

  const db = getDB(c.env);
  const [item] = await db
    .select({ image: items.image })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.businessId, businessId)));
  if (!item) return c.json({ error: "Item not found" }, 404);

  const [updated] = await db
    .update(items)
    .set({ image: null })
    .where(and(eq(items.id, itemId), eq(items.businessId, businessId)))
    .returning({ id: items.id });
  if (!updated) return c.json({ error: "Item not found" }, 404);

  await deleteOldImage(c, item.image, `businesses/${businessId}/items/${itemId}/`);
  return c.json({ image: null });
});

async function uploadBusinessImage(c: Context<AppEnv>, field: "logo" | "banner", maxBytes: number) {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked to this account" }, 403);
  const db = getDB(c.env);
  const [business] = await db
    .select({ image: field === "logo" ? businesses.logo : businesses.banner })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) return c.json({ error: "Business not found" }, 404);

  let image: Awaited<ReturnType<typeof readImageUpload>>;
  try {
    image = await readImageUpload(c.req.raw, maxBytes);
  } catch (error) {
    return uploadError(c, error);
  }

  const prefix = `businesses/${businessId}/${field}/`;
  const key = newImageKey(prefix, image.extension);
  const saved = await storeReplacement(c, key, business.image, prefix, image, async () => {
    if (field === "logo") {
      const [updated] = await db
        .update(businesses)
        .set({ logo: key })
        .where(eq(businesses.id, businessId))
        .returning({ id: businesses.id });
      return !!updated;
    }
    const [updated] = await db
      .update(businesses)
      .set({ banner: key })
      .where(eq(businesses.id, businessId))
      .returning({ id: businesses.id });
    return !!updated;
  });
  if (!saved) return c.json({ error: "Business not found" }, 404);
  return c.json({ image: imageUrl(key) });
}

async function deleteBusinessImage(c: Context<AppEnv>, field: "logo" | "banner") {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked to this account" }, 403);
  const db = getDB(c.env);
  const [business] = await db
    .select({ image: field === "logo" ? businesses.logo : businesses.banner })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) return c.json({ error: "Business not found" }, 404);

  let updated: { id: number } | undefined;
  if (field === "logo") {
    [updated] = await db
      .update(businesses)
      .set({ logo: null })
      .where(eq(businesses.id, businessId))
      .returning({ id: businesses.id });
  } else {
    [updated] = await db
      .update(businesses)
      .set({ banner: null })
      .where(eq(businesses.id, businessId))
      .returning({ id: businesses.id });
  }
  if (!updated) return c.json({ error: "Business not found" }, 404);

  await deleteOldImage(c, business.image, `businesses/${businessId}/${field}/`);
  return c.json({ image: null });
}

uploads.post("/business/logo", (c) => uploadBusinessImage(c, "logo", LOGO_IMAGE_MAX));
uploads.delete("/business/logo", (c) => deleteBusinessImage(c, "logo"));
uploads.post("/business/banner", (c) => uploadBusinessImage(c, "banner", BANNER_IMAGE_MAX));
uploads.delete("/business/banner", (c) => deleteBusinessImage(c, "banner"));

uploads.post("/user/image", async (c) => {
  const userId = c.get("user").id;
  const db = getDB(c.env);
  const [currentUser] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId));
  if (!currentUser) return c.json({ error: "User not found" }, 404);

  let image: Awaited<ReturnType<typeof readImageUpload>>;
  try {
    image = await readImageUpload(c.req.raw, ITEM_IMAGE_MAX);
  } catch (error) {
    return uploadError(c, error);
  }

  const prefix = `users/${userId}/avatar/`;
  const key = newImageKey(prefix, image.extension);
  const saved = await storeReplacement(c, key, currentUser.image, prefix, image, async () => {
    const [updated] = await db
      .update(user)
      .set({ image: key })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    return !!updated;
  });
  if (!saved) return c.json({ error: "User not found" }, 404);
  return c.json({ image: imageUrl(key) });
});

uploads.delete("/user/image", async (c) => {
  const userId = c.get("user").id;
  const db = getDB(c.env);
  const [currentUser] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId));
  if (!currentUser) return c.json({ error: "User not found" }, 404);

  const [updated] = await db
    .update(user)
    .set({ image: null })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (!updated) return c.json({ error: "User not found" }, 404);

  await deleteOldImage(c, currentUser.image, `users/${userId}/avatar/`);
  return c.json({ image: null });
});

export default uploads;
