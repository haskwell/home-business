import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getDB } from "../../db/client";
import { users } from "../../db/schema";

const auth = new Hono<{ Bindings: Env }>();

const RegisterSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/register
auth.post("/register", zValidator("json", RegisterSchema), async (c) => {
  const { name, password } = c.req.valid("json");
  const db = getDB(c.env);

  try {
    const [user] = await db
      .insert(users)
      .values({ name, password })
      .returning({ id: users.id, name: users.name });
    return c.json({ success: true, data: user }, 201);
  } catch (e) {
    // name is UNIQUE, so a duplicate insert throws
    const msg = `${e} ${(e as { cause?: unknown }).cause}`;
    if (msg.includes("UNIQUE")) {
      return c.json({ success: false, message: "Name already taken" }, 409);
    }
    throw e;
  }
});

// GET /api/auth/users
auth.get("/users", async (c) => {
  const db = getDB(c.env);
  const all = await db.select({ id: users.id, name: users.name }).from(users);
  return c.json({ success: true, data: all });
});

export default auth;
