import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { businesses } from "./businesses";
import { customers } from "./customers";
import { items } from "./menu";

export const customerOrders = sqliteTable("customer_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  status: text("status", { enum: ["pending", "delivered"] })
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
  trackingLink: text("tracking_link"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

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
});