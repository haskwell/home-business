import { eq, sql } from "drizzle-orm";
import { getDB } from "../../db/client";
import { businesses, businessContacts } from "../../db/schema";
import { user } from "../../db/schema/auth-schema";
import { imageUrl } from "../../lib/image";

type DB = ReturnType<typeof getDB>;

export async function getOwnedBusiness(db: DB, businessId: number) {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) return null;

  const contacts = await db
    .select({ contact: businessContacts.contact })
    .from(businessContacts)
    .where(eq(businessContacts.businessId, businessId));
  return {
    ...business,
    logo: imageUrl(business.logo),
    banner: imageUrl(business.banner),
    contacts: contacts.map(({ contact }) => contact),
  };
}

export async function createBusiness(
  db: DB,
  input: {
    userId: string;
    name: string;
    businessLink: string;
    description?: string;
    ownerContact: string;
  },
) {
  // INSERT ... SELECT makes the ownership check part of the same D1 batch as
  // the user link, so concurrent signup completion cannot create an orphan.
  const [insertResult] = await db.batch([
    db.run(sql`INSERT INTO businesses (name, business_link, description, owner_contact)
      SELECT ${input.name}, ${input.businessLink}, ${input.description ?? null}, ${input.ownerContact}
      WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ${input.userId} AND business_id IS NULL)`),
    db.run(sql`UPDATE "user"
      SET business_id = (SELECT id FROM businesses WHERE business_link = ${input.businessLink})
      WHERE id = ${input.userId} AND business_id IS NULL
        AND EXISTS (SELECT 1 FROM businesses WHERE business_link = ${input.businessLink})`),
  ]);
  if (!insertResult.meta.changes) return null;

  const [owner] = await db
    .select({ businessId: user.businessId })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!owner?.businessId) return null;
  return getOwnedBusiness(db, owner.businessId);
}

export async function getBusinessBySlug(db: DB, slug: string) {
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.businessLink, slug));
  return business ?? null;
}

export async function updateOwnedBusiness(
  db: DB,
  businessId: number,
  input: {
    name?: string;
    description?: string | null;
    businessLink?: string;
    instagram?: string | null;
    tiktok?: string | null;
    facebook?: string | null;
    ownerContact?: string | null;
    isAcceptingOrders?: boolean;
    contacts?: string[];
  },
) {
  const { contacts, ...fields } = input;
  if (Object.keys(fields).length) {
    await db.update(businesses).set(fields).where(eq(businesses.id, businessId));
  }
  if (contacts !== undefined) {
    await db.batch([
      db.delete(businessContacts).where(eq(businessContacts.businessId, businessId)),
      ...(contacts.length
        ? [db.insert(businessContacts).values(contacts.map((contact) => ({ businessId, contact })))]
        : []),
    ]);
  }
  return getOwnedBusiness(db, businessId);
}

export async function isBusinessSlugAvailable(db: DB, slug: string) {
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.businessLink, slug));
  return !business;
}
