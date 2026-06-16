// Keep in sync with the `LiteParseConfig` in the parent server's `src/lib/liteparse-config.ts`.

export type ParseInput = File | Blob | ArrayBuffer | ArrayBufferView;

export interface ParseOptions {
  filename?: string;
  mimetype?: string;
  signal?: AbortSignal;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof globalThis.fetch;
}

export const tokens = {
  success: "__SUCCESS__:",
  error: "__ERROR__:",
} as const;

export interface LiteParseConfig {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
}
