export type LiteparseError =
  | { kind: "invalid_input"; message: string }
  | { kind: "network"; cause: unknown }
  | { kind: "aborted" }
  | { kind: "http"; status: number; detail: string }
  | { kind: "stream_token"; message: string }
  | { kind: "decode"; message: string };

export function invalidInput(message: string): LiteparseError {
  return { kind: "invalid_input", message };
}

export function networkError(cause: unknown): LiteparseError {
  return { kind: "network", cause };
}

export function aborted(): LiteparseError {
  return { kind: "aborted" };
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
