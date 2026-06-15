import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { parseFormSchema } from "./schemas/parse";
import * as v from "valibot";
import { parse } from "./parse";
import { getServerLogger } from "./logger";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function createApp() {
  const app = new Hono();

  app.use("/parse", authMiddleware);
  app.use("/parse/*", authMiddleware);

  app.get("/health", (c) => c.text("OK"));

  app.post("/parse", async (c) => {
    const log = getServerLogger();

    const body = await c.req.parseBody();
    const file = body["file"];
    const configStr = body["config"];

    if (!(file instanceof File)) {
      return c.json(
        { detail: "You need to provide a file in the `file` field" },
        400,
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return c.json(
        { detail: `File too large; max ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        413,
      );
    }

    let config: Record<string, unknown> | undefined;
    if (typeof configStr === "string" && configStr.length > 0) {
      const parsed = v.safeParse(parseFormSchema.entries.config, configStr);
      if (!parsed.success) {
        return c.json(
          { detail: `Invalid config: ${parsed.issues[0]?.message ?? "parse error"}` },
          400,
        );
      }
      config = parsed.output as Record<string, unknown>;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parse({
      buffer,
      filename: file.name,
      mimetype: file.type,
      config: config as never,
    });

    log.info("Completed in {durationMs}ms", {
      durationMs: result.durationMs,
      filename: file.name,
      sizeBytes: buffer.length,
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
