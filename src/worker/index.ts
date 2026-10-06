import { Hono } from "hono";
import { getAuth } from "./auth";
import users from "./modules/users/routes";
import menu from "./modules/menu/routes";
import orders from "./modules/orders/routes";
import publicRoutes from "./modules/public/routes";

const app = new Hono<{ Bindings: Env }>();

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

app.route("/api/users", users);
app.route("/api/menu", menu);
app.route("/api/orders", orders);
app.route("/api/public", publicRoutes);

export default app;
