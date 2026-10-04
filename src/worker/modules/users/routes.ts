import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import { getAllUsers } from "./service";

const users = new Hono<AppEnv>();

users.use("*", requireAuth);

users.get("/", async (c) => {
  const allUsers = await getAllUsers(c.env);
  return c.json({ users: allUsers });
});

users.get("/me", (c) => c.json({ user: c.get("user") }));

export default users;
