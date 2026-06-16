import { ok, err, type Result } from "./result.js";
import {
  type LiteparseError,
  invalidInput,
  networkError,
  aborted,
  httpError,
  decodeError,
} from "./errors.js";
import { toFormData } from "./fetch-input.js";
import { readStreamBody } from "./stream.js";
import { VERSION } from "./version.js";
import {
  type ClientOptions,
  type ParseInput,
  type ParseOptions,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  RETRYABLE_STATUSES,
} from "./types.js";

const PATHS = {
  parse: "/parse",
  "parse-stream": "/parse-stream",
} as const;

export class LiteparseClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly endpoint: "parse" | "parse-stream";
  private readonly fetch: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = (opts.baseUrl ?? "https://api.liteparse.dev").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint ?? "parse";
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async parse(
    input: ParseInput,
    opts: ParseOptions = {},
  ): Promise<Result<string, LiteparseError>> {
    const userSignal = opts.signal;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (userSignal?.aborted) {
        return err(aborted("user"));
      }

      const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
      const combinedSignal = userSignal
        ? AbortSignal.any([userSignal, timeoutSignal])
        : timeoutSignal;

      const result = await this.parseOnce(input, opts, combinedSignal, timeoutSignal);

      if (result.ok || !isRetriable(result.error)) {
        return result;
      }

      if (attempt < this.maxRetries) {
        await sleep(this.backoffMs(attempt));
      } else {
        return result;
      }
    }

    throw new Error("retry loop exited unexpectedly");
  }

  private async parseOnce(
    input: ParseInput,
    opts: ParseOptions,
    combinedSignal: AbortSignal,
    timeoutSignal: AbortSignal,
  ): Promise<Result<string, LiteparseError>> {
    const filename = resolveFilename(input, opts);
    const mimetype = resolveMimetype(input, opts);
    if (!filename || !mimetype) {
      return err(
        invalidInput(
          !filename && !mimetype
            ? "filename and mimetype are required for non-File inputs"
            : !filename
            ? "filename is required for non-File inputs"
            : "mimetype is required for non-File inputs",
        ),
      );
    }

    const path = PATHS[this.endpoint];
    const url = `${this.baseUrl}${path}`;
    const body = toFormData(input, filename, mimetype, opts.config);
    const headers: Record<string, string> = {
      "User-Agent": `@falentio/liteparse-client/${VERSION}`,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        body,
        headers,
        signal: combinedSignal,
        duplex: "half",
      } as RequestInit);
    } catch (cause) {
      if (timeoutSignal.aborted) {
        return err(aborted("timeout"));
      }
      if (opts.signal?.aborted) {
        return err(aborted("user"));
      }
      return err(networkError(cause));
    }

    if (!response.ok) {
      const text = await response.text();
      let detail = text;
      try {
        const json = JSON.parse(text) as { detail?: string };
        if (typeof json.detail === "string") detail = json.detail;
      } catch {
        // not JSON; keep raw text
      }
      return err(httpError(response.status, detail));
    }

    if (this.endpoint === "parse-stream") {
      if (!response.body) {
        return err(decodeError("empty response body"));
      }
      return readStreamBody(response.body);
    }

    return ok(await response.text());
  }

  private backoffMs(attempt: number): number {
    return this.retryDelayMs * 2 ** attempt + Math.random() * this.retryDelayMs;
  }
}

function resolveFilename(input: ParseInput, opts: ParseOptions): string | undefined {
  if (input instanceof File && input.name) return input.name;
  return opts.filename;
}

function resolveMimetype(input: ParseInput, opts: ParseOptions): string | undefined {
  if (input instanceof File && input.type) return input.type;
  if (input instanceof Blob && input.type) return input.type;
  return opts.mimetype;
}

function isRetriable(error: LiteparseError): boolean {
  if (error.kind === "http" && RETRYABLE_STATUSES.has(error.status)) {
    return true;
  }
  if (error.kind === "aborted" && error.reason === "timeout") {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
