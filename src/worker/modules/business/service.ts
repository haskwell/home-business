import { and, eq, isNull } from "drizzle-orm";
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
  const [owner] = await db
    .select({ businessId: user.businessId })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!owner || owner.businessId !== null) return null;

  const [business] = await db
    .insert(businesses)
    .values({
      name: input.name,
      businessLink: input.businessLink,
      description: input.description ?? null,
      ownerContact: input.ownerContact,
    })
    .returning({ id: businesses.id });
  if (!business) return null;

  const [linkedOwner] = await db
    .update(user)
    .set({ businessId: business.id })
    .where(and(eq(user.id, input.userId), isNull(user.businessId)))
    .returning({ businessId: user.businessId });
  if (!linkedOwner) {
    await db.delete(businesses).where(eq(businesses.id, business.id));
    return null;
  }
  return getOwnedBusiness(db, business.id);
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
