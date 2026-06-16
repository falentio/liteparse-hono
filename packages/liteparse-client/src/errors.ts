import type { AbortReason } from "./types.js";

export type LiteparseError =
  | { kind: "invalid_input"; message: string }
  | { kind: "network"; cause: unknown }
  | { kind: "aborted"; reason: AbortReason }
  | { kind: "http"; status: number; detail: string }
  | { kind: "stream_token"; message: string }
  | { kind: "decode"; message: string };

export function invalidInput(message: string): LiteparseError {
  return { kind: "invalid_input", message };
}

export function networkError(cause: unknown): LiteparseError {
  return { kind: "network", cause };
}

export function aborted(reason: AbortReason): LiteparseError {
  return { kind: "aborted", reason };
}

export function httpError(status: number, detail: string): LiteparseError {
  return { kind: "http", status, detail };
}

export function streamTokenError(message: string): LiteparseError {
  return { kind: "stream_token", message };
}

export function decodeError(message: string): LiteparseError {
  return { kind: "decode", message };
}
