import { ok, err, type Result } from "./result.js";
import {
  type LiteparseError,
  invalidInput,
  networkError,
  aborted,
  httpError,
} from "./errors.js";
import { toFormData } from "./fetch-input.js";
import { readStreamBody } from "./stream.js";
import type {
  ClientOptions,
  ParseInput,
  ParseOptions,
} from "./types.js";

export class LiteparseClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly stream: boolean;
  private readonly fetch: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = (opts.baseUrl ?? "https://api.liteparse.dev").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.stream = opts.stream ?? false;
    this.fetch = opts.fetch ?? globalThis.fetch;
  }

  async parse(
    input: ParseInput,
    opts: ParseOptions = {},
    signal?: AbortSignal,
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

    const path = this.stream ? "/parse-stream" : "/parse";
    const url = `${this.baseUrl}${path}`;
    const body = toFormData(input, filename, mimetype, opts.config);
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        body,
        headers,
        signal,
        duplex: "half",
      } as RequestInit);
    } catch (cause) {
      if (
        cause instanceof DOMException &&
        cause.name === "AbortError"
      ) {
        return err(aborted());
      }
      if (signal?.aborted) {
        return err(aborted());
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

    if (this.stream) {
      if (!response.body) {
        return err({ kind: "decode", message: "empty response body" });
      }
      return readStreamBody(response.body);
    }

    return ok(await response.text());
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
