import { ApiResponse } from "../../lib/response";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../../lib/response";
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

business.post("/", zValidator("json", createSchema, validationHook), async (c) => {
  const currentUser = c.get("user");
  if (currentUser.businessId) {
    return ApiResponse.fromLegacy(c, { error: "This account already has a business" }, 409);
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
      return ApiResponse.fromLegacy(c, { error: "This account already has a business" }, 409);
    }
    return ApiResponse.fromLegacy(c, { business: created }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique constraint/i.test(message)) {
      return ApiResponse.fromLegacy(c, { error: "Business slug is already taken" }, 409);
    }
    throw error;
  }
});

business.get("/", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
  const ownBusiness = await getOwnedBusiness(getDB(c.env), businessId);
  if (!ownBusiness) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
  return ApiResponse.fromLegacy(c, { business: ownBusiness });
});

business.get("/slug-available", async (c) => {
  const query = z.object({ slug }).safeParse({ slug: c.req.query("slug") });
  if (!query.success) return ApiResponse.fromLegacy(c, { error: "Invalid or reserved business slug" }, 400);
  const available = await isBusinessSlugAvailable(getDB(c.env), query.data.slug);
  return ApiResponse.fromLegacy(c, { available });
});

business.patch("/", zValidator("json", patchSchema, validationHook), async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
  const input = c.req.valid("json");
  const db = getDB(c.env);

  if (input.businessLink) {
    const existing = await getBusinessBySlug(db, input.businessLink);
    if (existing && existing.id !== businessId) {
      return ApiResponse.fromLegacy(c, { error: "Business slug is already taken" }, 409);
    }
  }

  try {
    const updated = await updateOwnedBusiness(db, businessId, input);
    if (!updated) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
    return ApiResponse.fromLegacy(c, { business: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique constraint/i.test(message)) {
      return ApiResponse.fromLegacy(c, { error: "Business slug is already taken" }, 409);
    }
    throw error;
  }
});

export default business;
