import { and, asc, desc, eq } from "drizzle-orm";
import { getDB } from "../../db/client";
import { businessContacts, businesses, categories, items } from "../../db/schema";
import { imageUrl } from "../../lib/image";

export async function getPublicBusiness(env: Env, businessLink: string) {
  const db = getDB(env);
  const [business] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      description: businesses.description,
      logo: businesses.logo,
      banner: businesses.banner,
      instagram: businesses.instagram,
      tiktok: businesses.tiktok,
      facebook: businesses.facebook,
      isAcceptingOrders: businesses.isAcceptingOrders,
    })
    .from(businesses)
    .where(eq(businesses.businessLink, businessLink))
    .limit(1);
  if (!business) return null;

  const contacts = await db
    .select({ contact: businessContacts.contact })
    .from(businessContacts)
    .where(eq(businessContacts.businessId, business.id));

  return {
    name: business.name,
    description: business.description,
    logo: imageUrl(business.logo),
    banner: imageUrl(business.banner),
    instagram: business.instagram,
    tiktok: business.tiktok,
    facebook: business.facebook,
    contacts: contacts.map(({ contact }) => contact),
    isAcceptingOrders: business.isAcceptingOrders,
  };
}

export async function getPublicMenu(env: Env, businessId: number) {
  const db = getDB(env);
  const [categoryRows, itemRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.businessId, businessId))
      .orderBy(asc(categories.name)),
    db
      .select({
        id: items.id,
        name: items.name,
        description: items.description,
        categoryId: items.categoryId,
        price: items.price,
        inStock: items.inStock,
        image: items.image,
        priority: items.priority,
      })
      .from(items)
      .where(and(eq(items.businessId, businessId), eq(items.isListed, true)))
      .orderBy(desc(items.priority), asc(items.id)),
  ]);

  const categoryIds = new Set(categoryRows.map(({ id }) => id));
  const grouped = categoryRows.map((category) => ({
    ...category,
    items: itemRows
      .filter((item) => item.categoryId === category.id)
      .map(({ id, name, description, price, inStock, image }) => ({
        id,
        name,
        description,
        price,
        inStock,
        image: imageUrl(image),
      })),
  }));
  const uncategorizedItems = itemRows.filter(
    (item) => item.categoryId === null || !categoryIds.has(item.categoryId),
  );
  if (uncategorizedItems.length) {
    grouped.push({
      id: null,
      name: "Uncategorized",
      items: uncategorizedItems.map(({ id, name, description, price, inStock, image }) => ({
        id,
        name,
        description,
        price,
        inStock,
        image: imageUrl(image),
      })),
    });
  }

  return { categories: grouped };
}

export async function findPublicBusinessForOrder(env: Env, businessLink: string) {
  const db = getDB(env);
  const [business] = await db
    .select({ id: businesses.id, isAcceptingOrders: businesses.isAcceptingOrders })
    .from(businesses)
    .where(eq(businesses.businessLink, businessLink))
    .limit(1);
  return business ?? null;
}
