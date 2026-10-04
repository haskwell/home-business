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
  });
}

import { drizzle } from "drizzle-orm/d1";

export function getAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  return createAuth(env, db);
}
