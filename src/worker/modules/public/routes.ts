import { Hono } from "hono";
import { getTrackingInfo } from "../orders/service";

const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/track/:token", async (c) => {
  const token = c.req.param("token");

  // Cheap shape check so junk never reaches the database.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return c.json({ error: "Tracking link not found" }, 404);
  }

  const order = await getTrackingInfo(c.env, token);
  if (!order) return c.json({ error: "Tracking link not found" }, 404);

  c.header("Cache-Control", "no-store");
  return c.json({ order });
});

export default publicRoutes;
