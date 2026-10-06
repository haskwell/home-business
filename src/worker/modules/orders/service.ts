import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDB } from "../../db/client";
import { businesses, customerOrders, items, orderItems } from "../../db/schema";
import { imageUrl } from "../../lib/image";
import { generateTrackingToken } from "../../lib/ids";

export const ORDER_STATUSES = ["pending", "delivered", "cancelled"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type UpdateOrderInput = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string | null;
  address?: string;
  expectedDeliveryTime?: Date | null;
};

const orderColumns = {
  id: customerOrders.id,
  status: customerOrders.status,
  price: customerOrders.price,
  paymentStatus: customerOrders.paymentStatus,
  paymentMethod: customerOrders.paymentMethod,
  address: customerOrders.address,
  expectedDeliveryTime: customerOrders.expectedDeliveryTime,
  trackingLink: customerOrders.trackingLink,
  customerName: customerOrders.customerName,
  customerPhone: customerOrders.customerPhone,
  customerNote: customerOrders.customerNote,
  createdAt: customerOrders.createdAt,
  updatedAt: customerOrders.updatedAt,
};

export async function listOrders(
  env: Env,
  businessId: number,
  filters: { status?: OrderStatus; paymentStatus?: PaymentStatus },
) {
  const db = getDB(env);
  const conditions = [eq(customerOrders.businessId, businessId)];
  if (filters.status) conditions.push(eq(customerOrders.status, filters.status));
  if (filters.paymentStatus) conditions.push(eq(customerOrders.paymentStatus, filters.paymentStatus));

  return db
    .select(orderColumns)
    .from(customerOrders)
    .where(and(...conditions))
    .orderBy(desc(customerOrders.createdAt), desc(customerOrders.id));
}

export async function getOrderDetail(env: Env, businessId: number, orderId: number) {
  const db = getDB(env);
  const [order] = await db
    .select({
      ...orderColumns,
      businessLogo: businesses.logo,
      businessName: businesses.name,
    })
    .from(customerOrders)
    .innerJoin(businesses, eq(customerOrders.businessId, businesses.id))
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.businessId, businessId)))
    .limit(1);

  if (!order) return null;

  const lines = await db
    .select({
      id: orderItems.id,
      itemId: orderItems.itemId,
      name: items.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      extraNote: orderItems.extraNote,
    })
    .from(orderItems)
    .innerJoin(items, eq(orderItems.itemId, items.id))
    .where(eq(orderItems.orderId, orderId));

  return { ...order, businessLogo: imageUrl(order.businessLogo), items: lines };
}

export async function updateOrder(
  env: Env,
  businessId: number,
  orderId: number,
  patch: UpdateOrderInput,
) {
  const db = getDB(env);
  const [updated] = await db
    .update(customerOrders)
    .set(patch)
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.businessId, businessId)))
    .returning({ id: customerOrders.id });

  if (!updated) return null;
  return getOrderDetail(env, businessId, orderId);
}

export type GuestOrderLine = {
  itemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  extraNote: string | null;
};

export async function createGuestOrder(
  env: Env,
  input: {
    businessId: number;
    customerName: string;
    customerPhone: string;
    address: string;
    customerNote: string | null;
    price: number;
    trackingLink: string;
    items: GuestOrderLine[];
  },
) {
  const db = getDB(env);
  const [orderInsert] = await db.batch([
    db.run(sql`INSERT INTO customer_orders
      (business_id, customer_name, customer_phone, customer_note, address, status, price, payment_status, tracking_link)
      VALUES (${input.businessId}, ${input.customerName}, ${input.customerPhone}, ${input.customerNote},
        ${input.address}, 'pending', ${input.price}, 'unpaid', ${input.trackingLink})`),
    db.run(sql`INSERT INTO order_items
      (order_id, item_id, quantity, unit_price, total_price, extra_note)
      SELECT
        (SELECT id FROM customer_orders WHERE tracking_link = ${input.trackingLink}),
        CAST(json_extract(entry.value, '$.itemId') AS INTEGER),
        CAST(json_extract(entry.value, '$.quantity') AS INTEGER),
        CAST(json_extract(entry.value, '$.unitPrice') AS INTEGER),
        CAST(json_extract(entry.value, '$.totalPrice') AS INTEGER),
        json_extract(entry.value, '$.extraNote')
      FROM json_each(${JSON.stringify(input.items)}) AS entry`),
  ]);

  return {
    id: orderInsert.meta.last_row_id,
    trackingLink: input.trackingLink,
    price: input.price,
  };
}

export async function getGuestOrderByTrackingLink(
  env: Env,
  businessId: number,
  trackingLink: string,
) {
  const db = getDB(env);
  const [order] = await db
    .select({
      id: customerOrders.id,
      status: customerOrders.status,
      paymentStatus: customerOrders.paymentStatus,
      price: customerOrders.price,
    })
    .from(customerOrders)
    .where(and(
      eq(customerOrders.businessId, businessId),
      eq(customerOrders.trackingLink, trackingLink),
    ))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select({
      itemId: orderItems.itemId,
      name: items.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      extraNote: orderItems.extraNote,
    })
    .from(orderItems)
    .innerJoin(items, eq(orderItems.itemId, items.id))
    .where(eq(orderItems.orderId, order.id));
  return { ...order, items: lines };
}

// Returns only public order and item details. Customer contact and address data
// are deliberately excluded from the tracking response.
export async function getTrackingInfo(env: Env, token: string) {
  const db = getDB(env);
  const [order] = await db
    .select({
      id: customerOrders.id,
      status: customerOrders.status,
      paymentStatus: customerOrders.paymentStatus,
      price: customerOrders.price,
      expectedDeliveryTime: customerOrders.expectedDeliveryTime,
      createdAt: customerOrders.createdAt,
      updatedAt: customerOrders.updatedAt,
      businessName: businesses.name,
      businessLogo: businesses.logo,
    })
    .from(customerOrders)
    .innerJoin(businesses, eq(customerOrders.businessId, businesses.id))
    .where(eq(customerOrders.trackingLink, token))
    .limit(1);

  if (!order) return null;

  const lines = await db
    .select({
      name: items.name,
      quantity: orderItems.quantity,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .innerJoin(items, eq(orderItems.itemId, items.id))
    .where(eq(orderItems.orderId, order.id));

  return { ...order, businessLogo: imageUrl(order.businessLogo), items: lines };
}

// Kept for compatibility with the owner endpoint; new orders already have a token.
export async function ensureTrackingToken(env: Env, businessId: number, orderId: number) {
  const db = getDB(env);
  const [order] = await db
    .select({ trackingLink: customerOrders.trackingLink })
    .from(customerOrders)
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.businessId, businessId)))
    .limit(1);
  if (!order) return null;
  if (order.trackingLink) return order.trackingLink;

  const token = generateTrackingToken();
  await db
    .update(customerOrders)
    .set({ trackingLink: token })
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.businessId, businessId)));
  return token;
}
