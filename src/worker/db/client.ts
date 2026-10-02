import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const getDB = (env: Env) => drizzle(env.DB, { schema });
