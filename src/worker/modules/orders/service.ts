import { and, desc, eq } from "drizzle-orm";
import { getDB } from "../../db/client";
import {
  businesses,
  customerOrders,
  customers,
  items,
  orderItems,
} from "../../db/schema";
import { generateTrackingToken } from "../../lib/ids";

export const ORDER_STATUSES = ["pending", "delivered"] as const;
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
  createdAt: customerOrders.createdAt,
  updatedAt: customerOrders.updatedAt,
  customerName: customers.name,
  customerPhone: customers.phone,
};

export async function listOrders(
  env: Env,
  businessId: number,
  filters: { status?: OrderStatus; paymentStatus?: PaymentStatus },
) {
  const db = getDB(env);
  const conditions = [eq(customerOrders.businessId, businessId)];
  if (filters.status)
    conditions.push(eq(customerOrders.status, filters.status));
  if (filters.paymentStatus) {
    conditions.push(eq(customerOrders.paymentStatus, filters.paymentStatus));
  }

  return db
    .select(orderColumns)
    .from(customerOrders)
    .innerJoin(customers, eq(customerOrders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(customerOrders.createdAt), desc(customerOrders.id));
}

export async function getOrderDetail(
  env: Env,
  businessId: number,
  orderId: number,
) {
  const db = getDB(env);

  const [order] = await db
    .select(orderColumns)
    .from(customerOrders)
    .innerJoin(customers, eq(customerOrders.customerId, customers.id))
    .where(
      and(
        eq(customerOrders.id, orderId),
        eq(customerOrders.businessId, businessId),
      ),
    )
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

  return { ...order, items: lines };
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
    .where(
      and(
        eq(customerOrders.id, orderId),
        eq(customerOrders.businessId, businessId),
      ),
    )
    .returning({ id: customerOrders.id });

  if (!updated) return null;
  return getOrderDetail(env, businessId, orderId);
}

// Returns the order's tracking token, creating one if it doesn't have it yet.
export async function ensureTrackingToken(
  env: Env,
  businessId: number,
  orderId: number,
) {
  const db = getDB(env);

  const [order] = await db
    .select({ trackingLink: customerOrders.trackingLink })
    .from(customerOrders)
    .where(
      and(
        eq(customerOrders.id, orderId),
        eq(customerOrders.businessId, businessId),
      ),
    )
    .limit(1);

  if (!order) return null;
  if (order.trackingLink) return order.trackingLink;

  const token = generateTrackingToken();
  await db
    .update(customerOrders)
    .set({ trackingLink: token })
    .where(
      and(
        eq(customerOrders.id, orderId),
        eq(customerOrders.businessId, businessId),
      ),
    );
  return token;
}

// Public view: only fields that are safe to show to anyone holding the link.
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

  return { ...order, items: lines };
}
