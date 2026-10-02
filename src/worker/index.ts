import { Hono } from "hono";
import auth from "./modules/auth/routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/api/auth", auth);

export default app;
