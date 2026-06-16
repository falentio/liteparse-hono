import { Hono } from "hono";
import { stream } from "hono/streaming";
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

  app.post("/parse-stream", async (c) => {
    const log = getServerLogger();
    const parsed = await parseRequest(c);
    if (parsed instanceof Response) return parsed;

    return stream(c, async (w) => {
      let done = false;

      w.onAbort(() => {
        done = true;
      });

      await w.write(" ");

      (async () => {
        while (!done) {
          await w.sleep(5000);
          if (!done) {
            await w.write(" ");
          }
        }
      })();

      try {
        const result = await parse({
          buffer: parsed.buffer,
          filename: parsed.filename,
          mimetype: parsed.mimetype,
          config: parsed.config as never,
        });

        done = true;

        if (!w.aborted) {
          await w.write(result.text);
        }

        log.info("Completed in {durationMs}ms", {
          durationMs: result.durationMs,
          filename: parsed.filename,
          sizeBytes: parsed.buffer.length,
        });
      } catch (err) {
        done = true;

        if (!w.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          await w.write(`__ERROR__: ${message}`);

          log.error("Request failed: {message}", { message });
        }
      }
    });
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
