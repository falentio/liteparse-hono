# @falentio/liteparse-client

WinterTC-compliant client for the [liteparse-hono](https://www.npmjs.com/package/liteparse-hono) document parsing server.

## Requirements

- Node 22+ (or any WinterTC-compliant runtime that ships `fetch`, `ReadableStream`, `File`, `FormData`, `Blob`, `Request`, `Response`, `Headers`, `TextEncoder`, `TextDecoder`, `URL`, `URLSearchParams` as globals).

## Install

```bash
npm install @falentio/liteparse-client
```

## Usage

```ts
import { LiteparseClient } from "@falentio/liteparse-client";

const client = new LiteparseClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.API_KEY,         // optional; mirrors server's LITEPARSE_API_KEY
  endpoint: "parse",                   // "parse" → POST /parse; "parse-stream" → POST /parse-stream
});

const result = await client.parse(
  pdfBytes,                            // File | Blob | ArrayBuffer | Uint8Array
  { filename: "doc.pdf", mimetype: "application/pdf", config: { targetPages: "1" } },
);

if (result.ok) {
  console.log(result.value);
} else {
  switch (result.error.kind) {
    case "http":         console.error(`HTTP ${result.error.status}: ${result.error.detail}`); break;
    case "stream_token": console.error(`stream error: ${result.error.message}`); break;
    case "network":      console.error(`network error:`, result.error.cause); break;
    case "aborted":      console.error(`aborted (${result.error.reason})`); break;
    case "invalid_input":console.error(`invalid input: ${result.error.message}`); break;
    case "decode":       console.error(`decode error: ${result.error.message}`); break;
  }
}
```

## Options

The `LiteparseClient` constructor accepts these options (all optional except where noted):

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `baseUrl` | `string` | `"https://api.liteparse.dev"` | Server URL. Trailing slashes are stripped. |
| `apiKey` | `string` | — | Sent as `Authorization: Bearer <apiKey>`. Omit for unauthenticated servers. |
| `endpoint` | `"parse" \| "parse-stream"` | `"parse"` | Which server endpoint to hit. `"parse-stream"` uses prefix-token responses. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Inject a custom fetch (e.g., for testing or a proxy). |
| `maxRetries` | `number` | `3` | Retry attempts on HTTP 502/503/504 or client timeout. `0` disables. |
| `retryDelayMs` | `number` | `500` | Base delay (ms) for exponential backoff with jitter. |
| `timeoutMs` | `number` | `120000` | Per-attempt request timeout (ms). |

## Cancellation

Pass an `AbortSignal` on the options object:

```ts
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5000);
const result = await client.parse(input, { ...opts, signal: ctrl.signal });
// → { ok: false, error: { kind: "aborted", reason: "user" } }
```

## Idempotency

Retry is on by default (`maxRetries: 3`). The client retries on HTTP 502/503/504 responses and on the internal `timeoutMs` deadline. POST requests with a body are not generally idempotent, so a retried `parse()` can re-process the same document.

If your use case is not idempotent (e.g., the server meters per-parse usage), set `maxRetries: 0` in the constructor:

```ts
const client = new LiteparseClient({ baseUrl, apiKey, maxRetries: 0 });
```

## Error kinds

| `kind` | When | Shape |
|--------|------|-------|
| `invalid_input` | `filename` or `mimetype` could not be inferred from the input | `{ message }` |
| `network` | `fetch` threw (connection refused, DNS, etc.) | `{ cause }` |
| `aborted` | `AbortSignal` fired or client timeout fired | `{ reason: "user" \| "timeout" }` |
| `http` | Server returned non-2xx | `{ status, detail }` |
| `stream_token` | Stream body started with `__ERROR__:` | `{ message }` |
| `decode` | Stream body could not be read as utf-8 | `{ message }` |

## Exports

| Path | Purpose |
|------|---------|
| `@falentio/liteparse-client` | Main entry — `LiteparseClient` class + types |
| `@falentio/liteparse-client/node` | Side-effect entry that throws on missing WinterTC globals |
| `@falentio/liteparse-client/test-utils` | `stringToReadableStream`, `bytesToReadableStream`, `mockFetch`, `multipartRequestFromInput` |

## Test utilities

```ts
import { mockFetch, stringToReadableStream } from "@falentio/liteparse-client/test-utils";
```

## License

MIT
