import { createMiddleware } from "hono/factory";
import { getAuth } from "../auth";

type AuthUser = ReturnType<typeof getAuth>["$Infer"]["Session"]["user"];

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthUser };
};

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  await next();
});
