import { toFormData } from "./fetch-input.js";
import type { LiteParseConfig, ParseInput, ParseOptions } from "./types.js";

const PATHS = {
  parse: "/parse",
  "parse-stream": "/parse-stream",
} as const;

export function stringToReadableStream(
  ...chunks: string[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

export function bytesToReadableStream(
  ...chunks: Uint8Array[]
): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

export function erroringReadableStream(
  error: Error,
  preludeChunks: string[] = [],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < preludeChunks.length) {
        controller.enqueue(encoder.encode(preludeChunks[i]!));
        i++;
      } else {
        controller.error(error);
      }
    },
  });
}

export function mockFetch(
  handler: (req: Request) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    return handler(req);
  }) as typeof fetch;
}

export function multipartRequestFromInput(
  input: ParseInput,
  opts: ParseOptions = {},
  baseUrl = "https://api.example.com",
  endpoint: "parse" | "parse-stream" = "parse",
): Request {
  const path = PATHS[endpoint];
  const url = `${baseUrl}${path}`;
  const filename =
    input instanceof File ? input.name : (opts.filename ?? "buffer.bin");
  const mimetype =
    input instanceof File ? input.type : opts.mimetype;
  const fd = toFormData(input, filename, mimetype, opts.config as Partial<LiteParseConfig> | undefined);
  return new Request(url, { method: "POST", body: fd });
}
