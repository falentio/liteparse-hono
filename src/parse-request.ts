import * as v from "valibot";
import { parseFormSchema } from "./schemas/parse";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

export type ParsedRequest = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  config?: Record<string, unknown>;
};

export async function parseRequest(
  c: import("hono").Context,
): Promise<ParsedRequest | Response> {
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
        {
          detail: `Invalid config: ${
            parsed.issues[0]?.message ?? "parse error"
          }`,
        },
        400,
      );
    }
    config = parsed.output as Record<string, unknown>;
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    buffer,
    filename: file.name,
    mimetype: file.type,
    config,
  };
}
