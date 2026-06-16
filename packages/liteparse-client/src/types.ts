// Keep in sync with `LiteParseConfig` in `@llamaindex/liteparse@1.5.3` (the
// upstream parser the server uses). The client is an independent package
// and cannot import from there, so this interface is a hand-maintained
// mirror. If the upstream type gains or changes fields, update this file.

export type ParseInput = File | Blob | ArrayBuffer | ArrayBufferView;

export interface ParseOptions {
  filename?: string;
  mimetype?: string;
  config?: Partial<LiteParseConfig>;
  /**
   * `AbortSignal` to cancel the request. If already aborted, the request is not
   * sent and a `Result.err` with `kind: "aborted"` is returned.
   */
  signal?: AbortSignal;
}

export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  /**
   * Which server endpoint to use.
   * - "parse": POST /parse — plain text or JSON response.
   * - "parse-stream": POST /parse-stream — response prefixed with `__SUCCESS__:` or `__ERROR__:` tokens.
   * @defaultValue "parse"
   */
  endpoint?: "parse" | "parse-stream";
  fetch?: typeof globalThis.fetch;
}

export const tokens = {
  successPrefix: "__SUCCESS__:",
  errorPrefix: "__ERROR__:",
} as const;

export type OutputFormat = "json" | "text";

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
