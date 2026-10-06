import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import { getAllUsers } from "./service";
import { imageUrl } from "../../lib/image";

const users = new Hono<AppEnv>();

users.use("*", requireAuth);

users.get("/", async (c) => {
  const allUsers = await getAllUsers(c.env);
  return c.json({ users: allUsers });
});

users.get("/me", (c) => {
  const currentUser = c.get("user");
  return c.json({ user: { ...currentUser, image: imageUrl(currentUser.image) } });
});

export default users;
