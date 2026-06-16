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
  stream: false,                       // false → POST /parse; true → POST /parse-stream
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
    case "aborted":      console.error("aborted"); break;
    case "invalid_input":console.error(`invalid input: ${result.error.message}`); break;
    case "decode":       console.error(`decode error: ${result.error.message}`); break;
  }
}
```

## Cancellation

Pass an `AbortSignal` as the third argument:

```ts
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5000);
const result = await client.parse(input, opts, ctrl.signal);
// → { ok: false, error: { kind: "aborted" } }
```

## Error kinds

| `kind` | When | Shape |
|--------|------|-------|
| `invalid_input` | `filename` or `mimetype` could not be inferred from the input | `{ message }` |
| `network` | `fetch` threw (connection refused, DNS, etc.) | `{ cause }` |
| `aborted` | `AbortSignal` fired | — |
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
