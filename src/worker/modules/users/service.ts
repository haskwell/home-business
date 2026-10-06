import { asc } from "drizzle-orm";
import { getDB } from "../../db/client";
import { user } from "../../db/schema/auth-schema";
import { imageUrl } from "../../lib/image";

export async function getAllUsers(env: Env) {
  const db = getDB(env);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      number: user.number,
      businessId: user.businessId,
    })
    .from(user)
    .orderBy(asc(user.createdAt));
  return rows.map((row) => ({ ...row, image: imageUrl(row.image) }));
}
