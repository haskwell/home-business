import { Hono } from "hono";
import { getAuth } from "./auth";
import users from "./modules/users/routes";
import menu from "./modules/menu/routes";
import orders from "./modules/orders/routes";
import publicRoutes from "./modules/public/routes";
import business from "./modules/business/routes";
import uploads from "./modules/uploads/routes";

const app = new Hono<{ Bindings: Env }>();

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

app.route("/api/users", users);
app.route("/api/business", business);
app.route("/api/uploads", uploads);
app.route("/api/menu", menu);
app.route("/api/orders", orders);
app.route("/api/public", publicRoutes);

export default app;
