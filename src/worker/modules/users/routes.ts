import { ApiResponse } from "../../lib/response";
import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../../middleware/requireAuth";
import { getAllUsers } from "./service";
import { imageUrl } from "../../lib/image";

const users = new Hono<AppEnv>();

users.use("*", requireAuth);

users.get("/", async (c) => {
  const allUsers = await getAllUsers(c.env);
  return ApiResponse.fromLegacy(c, { users: allUsers });
});

users.get("/me", (c) => {
  const currentUser = c.get("user");
  return ApiResponse.fromLegacy(c, { user: { ...currentUser, image: imageUrl(currentUser.image) } });
});

export default users;
