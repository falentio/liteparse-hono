import { ok, err, type Result } from "./result.js";
import {
  streamTokenError,
  decodeError,
  type LiteparseError,
} from "./errors.js";
import { tokens } from "./types.js";

export async function readStreamBody(
  body: ReadableStream<Uint8Array>,
): Promise<Result<string, LiteparseError>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (done) break;
    }
    buffer += decoder.decode();
  } catch (cause) {
    return err(
      decodeError(cause instanceof Error ? cause.message : String(cause)),
    );
  } finally {
    reader.releaseLock();
  }

  const text = buffer.trim();

  if (text.startsWith(tokens.errorPrefix)) {
    return err(
      streamTokenError(text.slice(tokens.errorPrefix.length).trim()),
    );
  }
  if (text.startsWith(tokens.successPrefix)) {
    return ok(text.slice(tokens.successPrefix.length));
  }
  return ok(text);
}
