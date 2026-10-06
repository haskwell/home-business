import { integer, text, index, sqliteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { businesses } from "./businesses";
import { items } from "./menu";

export const customerOrders = sqliteTable("customer_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerNote: text("customer_note"),
  status: text("status", { enum: ["pending", "delivered", "cancelled"] })
    .notNull()
    .default("pending"),
  price: integer("price").notNull().default(0),
  paymentStatus: text("payment_status", { enum: ["unpaid", "paid"] })
    .notNull()
    .default("unpaid"),
  paymentMethod: text("payment_method"),
  address: text("address").notNull(),
  expectedDeliveryTime: integer("expected_delivery_time", {
    mode: "timestamp",
  }),
  trackingLink: text("tracking_link").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
}, (table) => [index("customer_orders_business_id_idx").on(table.businessId)]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => customerOrders.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  totalPrice: integer("total_price").notNull(),
  extraNote: text("extra_note"),
}, (table) => [index("order_items_order_id_idx").on(table.orderId)]);
