import { integer, text, index, sqliteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { businesses } from "./businesses";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
}, (table) => [index("categories_business_id_idx").on(table.businessId)]);

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  categoryId: integer("category_id")
    .references(() => categories.id)
    .default(sql`NULL`),
  price: integer("price").notNull(),
  isListed: integer("is_listed", { mode: "boolean" }).notNull().default(true),
  inStock: integer("in_stock", { mode: "boolean" }).notNull().default(true),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
  priority: integer("priority").notNull().default(0),
}, (table) => [index("items_business_id_idx").on(table.businessId)]);
