import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";

const ENV_KEY = process.env.LITEPARSE_API_KEY;
const ENV_KEY_ENABLED = typeof ENV_KEY === "string" && ENV_KEY.length > 0;

function unauthorized(c: import("hono").Context) {
  return c.json({ detail: "Unauthorized" }, 401);
}

export const authMiddleware = createMiddleware(async (c, next) => {
  if (!ENV_KEY_ENABLED) {
    return next();
  }

  const header = c.req.header("Authorization") ?? "";
  const expected = `Bearer ${ENV_KEY}`;

  if (header.length !== expected.length) {
    return unauthorized(c);
  }

  const headerBuf = Buffer.from(header, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const ok = timingSafeEqual(headerBuf, expectedBuf);

  if (!ok) {
    return unauthorized(c);
  }

  return next();
});
