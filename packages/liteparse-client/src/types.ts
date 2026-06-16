// Keep in sync with `LiteParseConfig` in `@llamaindex/liteparse@1.5.3` (the
// upstream parser the server uses). The client is an independent package
// and cannot import from there, so this interface is a hand-maintained
// mirror. If the upstream type gains or changes fields, update this file.

/** A document payload accepted by `parse()`. */
export type ParseInput = File | Blob | ArrayBuffer | ArrayBufferView;

export interface ParseOptions {
  /**
   * Filename to attach to the multipart upload. Required when `input` is not a
   * `File` (the client cannot infer a name from a `Blob`, `ArrayBuffer`, or
   * `ArrayBufferView`).
   */
  filename?: string;
  /**
   * MIME type of the payload. Required when `input` is not a `File` or `Blob`
   * with a `.type` set.
   */
  mimetype?: string;
  /**
   * Partial server-side parser config. Only the fields you set are sent; the
   * server fills in defaults for the rest.
   */
  config?: Partial<LiteParseConfig>;
  /**
   * `AbortSignal` to cancel the request. If already aborted, the request is not
   * sent and a `Result.err` with `kind: "aborted"` is returned.
   */
  signal?: AbortSignal;
}

export interface ClientOptions {
  /**
   * Server base URL. Trailing slashes are stripped.
   * @defaultValue "https://api.liteparse.dev"
   */
  baseUrl?: string;
  /**
   * API key sent as `Authorization: Bearer <apiKey>`. Omit for unauthenticated
   * servers.
   */
  apiKey?: string;
  /**
   * Which server endpoint to use.
   * - "parse": POST /parse — plain text or JSON response.
   * - "parse-stream": POST /parse-stream — response prefixed with `__SUCCESS__:` or `__ERROR__:` tokens.
   * @defaultValue "parse"
   */
  endpoint?: "parse" | "parse-stream";
  /**
   * Custom `fetch` implementation. Use to inject a proxy, instrumentation, or
   * a mock in tests.
   * @defaultValue globalThis.fetch
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Maximum number of retry attempts after the first failure. Set to `0` to disable.
   * Retries are attempted on HTTP 502/503/504 and on internal client timeout.
   * @defaultValue 3
   */
  maxRetries?: number;
  /**
   * Base delay (ms) between retry attempts. The actual delay is exponential with jitter:
   * `retryDelayMs * 2^attempt + random(0, retryDelayMs)ms`.
   * @defaultValue 500
   */
  retryDelayMs?: number;
  /**
   * Per-attempt request timeout (ms). A fresh timeout is started for each retry attempt.
   * If the timeout fires, the error is `Result.err` with `kind: "aborted"` and `reason: "timeout"`.
   * @defaultValue 120000
   */
  timeoutMs?: number;
}

/** Default `maxRetries` (3) when not configured on `ClientOptions`. */
export const DEFAULT_MAX_RETRIES = 3;
/** Default `retryDelayMs` (500) — base for exponential backoff with jitter. */
export const DEFAULT_RETRY_DELAY_MS = 500;
/** Default `timeoutMs` (120000) — per-attempt request timeout. */
export const DEFAULT_TIMEOUT_MS = 120000;

/** HTTP status codes that the client retries on (502, 503, 504). */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/** Reason the request was aborted. */
export type AbortReason = "user" | "timeout";

export const tokens = {
  successPrefix: "__SUCCESS__:",
  errorPrefix: "__ERROR__:",
} as const;

/** Format the server writes the parsed body in. */
export type OutputFormat = "json" | "text";

/** Server-side grid debug options. */
export interface GridDebugConfig {
  enabled: boolean;
  textFilter?: string[];
  lineFilter?: number[];
  pageFilter?: number;
  regionFilter?: { x1: number; y1: number; x2: number; y2: number };
  outputPath?: string;
  visualize?: boolean;
  visualizePath?: string;
  trace?: boolean;
}

/**
 * Server-side parser configuration, passed through `ParseOptions.config`.
 *
 * @remarks
 * This is a hand-maintained TypeScript mirror of `LiteParseConfig` in
 * `@llamaindex/liteparse@1.5.3` (the upstream parser the server uses). The
 * client is an independent package and cannot import from there. If the
 * upstream type gains, renames, or removes fields, this mirror may drift —
 * please open an issue if you need a field that isn't yet exposed.
 */
export interface LiteParseConfig {
  ocrLanguage: string | string[];
  ocrEnabled: boolean;
  ocrServerUrl?: string;
  tessdataPath?: string;
  numWorkers: number;
  maxPages: number;
  targetPages?: string;
  dpi: number;
  outputFormat: OutputFormat;
  preciseBoundingBox: boolean;
  preserveVerySmallText: boolean;
  preserveLayoutAlignmentAcrossPages: boolean;
  password?: string;
  debug?: GridDebugConfig;
}
