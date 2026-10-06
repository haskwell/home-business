import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ensureTrackingToken,
  getOrderDetail,
  listOrders,
  updateOrder,
} from "./service";

const orders = new Hono<AppEnv>();

orders.use("*", requireAuth);

const listQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

const patchBody = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    paymentMethod: z.string().trim().max(50).nullable().optional(),
    address: z.string().trim().min(1).max(500).optional(),
    expectedDeliveryTime: z.iso.datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update",
  });

function trackingUrl(c: Context<AppEnv>, token: string | null) {
  return token ? `${new URL(c.req.url).origin}/track/${token}` : null;
}

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

orders.get("/", zValidator("query", listQuery), async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked" }, 403);

  const rows = await listOrders(c.env, businessId, c.req.valid("query"));
  return c.json({
    orders: rows.map((o) => ({
      ...o,
      trackingUrl: trackingUrl(c, o.trackingLink),
    })),
  });
});

orders.get("/:id", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked" }, 403);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Order not found" }, 404);

  const order = await getOrderDetail(c.env, businessId, id);
  if (!order) return c.json({ error: "Order not found" }, 404);

  return c.json({
    order: { ...order, trackingUrl: trackingUrl(c, order.trackingLink) },
  });
});

orders.patch("/:id", zValidator("json", patchBody), async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked" }, 403);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Order not found" }, 404);

  const body = c.req.valid("json");
  const { expectedDeliveryTime, ...rest } = body;

  const order = await updateOrder(c.env, businessId, id, {
    ...rest,
    ...(expectedDeliveryTime !== undefined && {
      expectedDeliveryTime:
        expectedDeliveryTime === null ? null : new Date(expectedDeliveryTime),
    }),
  });
  if (!order) return c.json({ error: "Order not found" }, 404);

  return c.json({
    order: { ...order, trackingUrl: trackingUrl(c, order.trackingLink) },
  });
});

// Creates the tracking link if the order doesn't have one; otherwise returns the existing one.
orders.post("/:id/tracking-link", async (c) => {
  const businessId = c.get("user").businessId;
  if (!businessId) return c.json({ error: "No business linked" }, 403);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "Order not found" }, 404);

  const token = await ensureTrackingToken(c.env, businessId, id);
  if (!token) return c.json({ error: "Order not found" }, 404);

  return c.json({ trackingUrl: trackingUrl(c, token) });
});

export default orders;
