import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { parseRequest } from "./parse-request";
import { parse } from "./parse";
import { getServerLogger } from "./logger";

export function createApp() {
  const app = new Hono();

  app.use("/parse", authMiddleware);
  app.use("/parse/*", authMiddleware);

  app.get("/health", (c) => c.text("OK"));

  app.post("/parse", async (c) => {
    const log = getServerLogger();
    const parsed = await parseRequest(c);
    if (parsed instanceof Response) return parsed;

    const result = await parse({
      buffer: parsed.buffer,
      filename: parsed.filename,
      mimetype: parsed.mimetype,
      config: parsed.config as never,
    });

    log.info("Completed in {durationMs}ms", {
      durationMs: result.durationMs,
      filename: parsed.filename,
      sizeBytes: parsed.buffer.length,
    });

    return c.text(result.text);
  });

  app.onError((err, c) => {
    getServerLogger().error("Request failed: {message}", {
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { detail: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  });

  return app;
}
