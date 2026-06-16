import type { AbortReason } from "./types.js";

/**
 * A structured error returned by `parse()` when the operation does not
 * succeed. The `kind` discriminator lets you narrow the shape.
 *
 * @remarks
 * Variants:
 * - `invalid_input` — `filename` or `mimetype` could not be inferred from the input.
 * - `network` — `fetch` threw (connection refused, DNS failure, etc.).
 * - `aborted` — `AbortSignal` fired; `reason` is `"user"` (caller aborted) or `"timeout"` (client timeout).
 * - `http` — server returned a non-2xx status.
 * - `stream_token` — the streaming response body started with the `__ERROR__:` prefix.
 * - `decode` — the streaming response body could not be read as utf-8.
 */
export type LiteparseError =
  | { kind: "invalid_input"; message: string }
  | { kind: "network"; cause: unknown }
  | { kind: "aborted"; reason: AbortReason }
  | { kind: "http"; status: number; detail: string }
  | { kind: "stream_token"; message: string }
  | { kind: "decode"; message: string };

/** Construct an `invalid_input` error. */
export function invalidInput(message: string): LiteparseError {
  return { kind: "invalid_input", message };
}

/** Construct a `network` error. */
export function networkError(cause: unknown): LiteparseError {
  return { kind: "network", cause };
}

/** Construct an `aborted` error. */
export function aborted(reason: AbortReason): LiteparseError {
  return { kind: "aborted", reason };
}

/** Construct an `http` error. */
export function httpError(status: number, detail: string): LiteparseError {
  return { kind: "http", status, detail };
}

/** Construct a `stream_token` error. */
export function streamTokenError(message: string): LiteparseError {
  return { kind: "stream_token", message };
}

/** Construct a `decode` error. */
export function decodeError(message: string): LiteparseError {
  return { kind: "decode", message };
}
