import { ApiResponse } from "../../lib/response";
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../../lib/response";
import { getDB } from "../../db/client";
import { items } from "../../db/schema";
import {
  createGuestOrder,
  getGuestOrderByTrackingLink,
  getTrackingInfo,
  type GuestOrderLine,
} from "../orders/service";
import { generateTrackingToken, trackingTokenForIdempotencyKey } from "../../lib/ids";
import { isPublicImageKey } from "../../lib/image";
import { findPublicBusinessForOrder, getPublicBusiness, getPublicMenu } from "./service";

const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/businesses/:businessLink", async (c) => {
  const business = await getPublicBusiness(c.env, c.req.param("businessLink").toLowerCase());
  if (!business) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
  return ApiResponse.fromLegacy(c, { business });
});

publicRoutes.get("/businesses/:businessLink/menu", async (c) => {
  const linkedBusiness = await findPublicBusinessForOrder(
    c.env,
    c.req.param("businessLink").toLowerCase(),
  );
  if (!linkedBusiness) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);
  const menu = await getPublicMenu(c.env, linkedBusiness.id);
  c.header("Cache-Control", "public, max-age=60, s-maxage=60");
  return ApiResponse.fromLegacy(c, { menu });
});

const guestOrderSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  customerPhone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Use 7 to 15 digits with an optional leading +"),
  address: z.string().trim().min(1).max(500),
  customerNote: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    extraNote: z.string().trim().max(200).optional(),
  })).min(1).max(50),
});

publicRoutes.post("/businesses/:businessLink/orders", zValidator("json", guestOrderSchema, validationHook), async (c) => {
  const businessLink = c.req.param("businessLink").toLowerCase();
  const business = await findPublicBusinessForOrder(c.env, businessLink);
  if (!business) return ApiResponse.fromLegacy(c, { error: "Business not found" }, 404);

  const rawIdempotencyKey = c.req.header("Idempotency-Key")?.trim();
  if (rawIdempotencyKey && !/^[A-Za-z0-9._~-]{16,128}$/.test(rawIdempotencyKey)) {
    return ApiResponse.fromLegacy(c, { error: "Invalid Idempotency-Key" }, 400);
  }
  const trackingToken = rawIdempotencyKey
    ? await trackingTokenForIdempotencyKey(
        c.env.BETTER_AUTH_SECRET,
        business.id,
        rawIdempotencyKey,
      )
    : generateTrackingToken();

  if (rawIdempotencyKey) {
    const existing = await getGuestOrderByTrackingLink(c.env, business.id, trackingToken);
    if (existing) {
      return ApiResponse.fromLegacy(c, {
        order: existing,
        trackingToken,
        trackingUrl: `/track/${trackingToken}`,
      });
    }
  }

  if (!business.isAcceptingOrders) {
    return ApiResponse.fromLegacy(c, { error: "This business is not accepting orders" }, 409);
  }

  const input = c.req.valid("json");
  const merged = new Map<number, { quantity: number; notes: string[] }>();
  for (const line of input.items) {
    const current = merged.get(line.itemId) ?? { quantity: 0, notes: [] };
    current.quantity += line.quantity;
    if (line.extraNote && !current.notes.includes(line.extraNote)) current.notes.push(line.extraNote);
    merged.set(line.itemId, current);
  }

  const invalidQuantityIds = [...merged]
    .filter(([, value]) => value.quantity > 99)
    .map(([itemId]) => itemId);
  if (invalidQuantityIds.length) {
    return ApiResponse.fromLegacy(c, { error: "Combined item quantities cannot exceed 99", itemIds: invalidQuantityIds }, 400);
  }

  const db = getDB(c.env);
  const itemIds = [...merged.keys()];
  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      price: items.price,
      isListed: items.isListed,
      inStock: items.inStock,
    })
    .from(items)
    .where(and(eq(items.businessId, business.id), inArray(items.id, itemIds)));
  const rowById = new Map(rows.map((item) => [item.id, item]));
  const invalidItemIds = itemIds.filter((id) => {
    const item = rowById.get(id);
    return !item || !item.isListed || !item.inStock;
  });
  if (invalidItemIds.length) {
    return ApiResponse.fromLegacy(c, {
      error: "Some items are unavailable",
      itemIds: invalidItemIds,
    }, 400);
  }

  const orderLines: GuestOrderLine[] = [];
  const lineSummary: Array<GuestOrderLine & { name: string }> = [];
  let orderPrice = 0;
  for (const [itemId, selection] of merged) {
    const item = rowById.get(itemId)!;
    const totalPrice = item.price * selection.quantity;
    if (!Number.isSafeInteger(item.price) || !Number.isSafeInteger(totalPrice) || item.price < 0) {
      return ApiResponse.fromLegacy(c, { error: "An item has an invalid price", itemIds: [itemId] }, 400);
    }
    orderPrice += totalPrice;
    if (!Number.isSafeInteger(orderPrice)) return ApiResponse.fromLegacy(c, { error: "Order total is too large" }, 400);
    const line = {
      itemId,
      quantity: selection.quantity,
      unitPrice: item.price,
      totalPrice,
      extraNote: selection.notes.length ? selection.notes.join("; ") : null,
    };
    orderLines.push(line);
    lineSummary.push({ ...line, name: item.name });
  }

  let order: Awaited<ReturnType<typeof createGuestOrder>>;
  try {
    order = await createGuestOrder(c.env, {
      businessId: business.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address,
      customerNote: input.customerNote || null,
      price: orderPrice,
      trackingLink: trackingToken,
      items: orderLines,
    });
  } catch (error) {
    if (rawIdempotencyKey && error instanceof Error && /unique constraint/i.test(error.message)) {
      const existing = await getGuestOrderByTrackingLink(c.env, business.id, trackingToken);
      if (existing) {
        return ApiResponse.fromLegacy(c, {
          order: existing,
          trackingToken,
          trackingUrl: `/track/${trackingToken}`,
        });
      }
    }
    throw error;
  }

  return ApiResponse.fromLegacy(c, {
    order: {
      id: order.id,
      status: "pending",
      paymentStatus: "unpaid",
      price: orderPrice,
      items: lineSummary,
    },
    trackingToken,
    trackingUrl: `/track/${trackingToken}`,
  }, 201);
});

publicRoutes.get("/images/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const imagePathPrefix = "/api/public/images/";
  const rawKey = pathname.startsWith(imagePathPrefix)
    ? pathname.slice(imagePathPrefix.length)
    : "";
  let key: string;
  try {
    key = rawKey.split("/").map(decodeURIComponent).join("/");
  } catch {
    key = "";
  }
  if (!key || !isPublicImageKey(key)) {
    return ApiResponse.fromLegacy(c, { error: "Invalid image key" }, 404);
  }

  const object = await c.env.BUCKET.get(key);
  if (!object) return ApiResponse.fromLegacy(c, { error: "Image not found" }, 404);

  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: object.httpEtag,
    "X-Content-Type-Options": "nosniff",
  });
  const ifNoneMatch = c.req.header("If-None-Match");
  if (
    ifNoneMatch?.split(",").some((tag) => {
      const candidate = tag.trim();
      return candidate === "*" || candidate.replace(/^W\//, "") === object.httpEtag;
    })
  ) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
});

publicRoutes.get("/track/:token", async (c) => {
  const token = c.req.param("token");

  // Cheap shape check so junk never reaches the database.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return ApiResponse.fromLegacy(c, { error: "Tracking link not found" }, 404);
  }

  const order = await getTrackingInfo(c.env, token);
  if (!order) return ApiResponse.fromLegacy(c, { error: "Tracking link not found" }, 404);

  c.header("Cache-Control", "no-store");
  return ApiResponse.fromLegacy(c, { order });
});

export default publicRoutes;
