import { Hono } from "hono";
import { getAuth } from "./auth";
import users from "./modules/users/routes";
import menu from "./modules/menu/routes";

const app = new Hono<{ Bindings: Env }>();

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

app.route("/api/users", users);
app.route("/api/menu", menu);

export default app;
