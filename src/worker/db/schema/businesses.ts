import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const businesses = sqliteTable("businesses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  rating: integer("rating").notNull().default(0),
  logo: text("logo"),
  banner: text("banner"),
  instagram: text("instagram"),
  tiktok: text("tiktok"),
  facebook: text("facebook"),
  businessLink: text("business_link").notNull().unique(),
  ownerContact: text("owner_contact"),
  isAcceptingOrders: integer("is_accepting_orders", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const businessContacts = sqliteTable("business_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  contact: text("contact").notNull(),
});
