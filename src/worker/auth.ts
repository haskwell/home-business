import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema/auth-schema";

export function createAuth(env: Env, db: DrizzleD1Database<typeof schema>) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        number: { type: "string", required: true },
        businessId: { type: "number", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            const [created] = await db
              .insert(businesses)
              .values({ name: `${userData.name}'s Business` })
              .returning();

            return {
              data: {
                ...userData,
                businessId: created.id,
              },
            };
          },
        },
      },
    },
  });
}

import { drizzle } from "drizzle-orm/d1";
import { businesses } from "./db/schema";

export function getAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  return createAuth(env, db);
}
