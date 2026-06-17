# @falentio/liteparse-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, publishable npm package `@falentio/liteparse-client` — a WinterTC-compliant client for the `liteparse-hono` server, supporting `File | Blob | ArrayBuffer | ArrayBufferView` input, both `POST /parse` and `POST /parse-stream` via a single `parse()` method selected by a constructor `stream` flag, returning `Promise<Result<string, LiteparseError>>`.

**Architecture:** Per-concern module layout (`result`, `errors`, `types`, `fetch-input`, `stream`, `node`, `client`, `index`, `test-utils`). The client is independent of the monorepo — no `packages:` entry in `pnpm-workspace.yaml`, no parent `liteparse-hono` dep. The `stream` flag is a runtime behavior switch; stream mode reads the full body, trims, and inspects the prefix token (`__SUCCESS__:` or `__ERROR__:`). All failures are returned as `Result.err`; the returned Promise never rejects. WinterTC globals are assumed; `@falentio/liteparse-client/node` is a feature-detect entrypoint that throws on missing globals. Test utilities (`/test-utils`) are a separate exports-map entry, never bundled with the main entry.

**Tech Stack:** TypeScript 6.x, rollup 4.x, `@rollup/plugin-typescript`, `@rollup/plugin-node-resolve`, `rollup-plugin-dts`, vitest 4.x, Node 22+ (native WinterTC globals). No runtime dependencies.

---

## File Structure

**Created (all under `packages/liteparse-client/`):**
- `package.json` — name `@falentio/liteparse-client`, v0.1.0, MIT, `type: "module"`, `engines.node: ">=22"`, `sideEffects: false`, exports map for `.`, `./node`, `./test-utils`, scripts: `build`, `test`, `typecheck`, `lint`.
- `tsconfig.json` — extends the monorepo's style: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `lib: [ES2022, DOM]`, `strict: true`, `noUncheckedIndexedAccess: true`, `declaration: true`, `declarationDir: dist`, `emitDeclarationOnly: false`.
- `rollup.config.mjs` — three entries (`src/index.ts`, `src/node.ts`, `src/test-utils.ts`), TypeScript + node-resolve plugins, ESM output, dts pass for `.d.ts` files.
- `vitest.config.ts` — node environment, include `__tests__/**/*.test.ts`.
- `LICENSE` — MIT, full text.
- `README.md` — usage, exports map, error kinds, examples for `parse()` and `parseStream()` (selected via constructor).
- `.gitignore` — `dist/`, `node_modules/`, `coverage/`, `*.log`.
- `src/result.ts` — `Result<T, E>` discriminated union.
- `src/errors.ts` — `LiteparseError` union + factory functions.
- `src/types.ts` — `LiteParseConfig` (hand-written mirror), `ParseInput`, `ParseOptions`, `ClientOptions`.
- `src/fetch-input.ts` — `toFormData(input, filename, mimetype, config?)` pure function.
- `src/stream.ts` — `readStreamBody(body)` returns `Result<string, LiteparseError>`.
- `src/node.ts` — `assertWinterTcGlobals()` throws on missing globals.
- `src/client.ts` — `LiteparseClient` class with `parse(input, opts?, signal?)`.
- `src/index.ts` — re-exports `LiteparseClient`, `Result`, `LiteparseError`, type exports.
- `src/test-utils.ts` — `stringToReadableStream`, `bytesToReadableStream`, `mockFetch`, `multipartRequestFromInput`.
- `__tests__/result.test.ts`
- `__tests__/errors.test.ts`
- `__tests__/fetch-input.test.ts`
- `__tests__/stream.test.ts`
- `__tests__/node.test.ts`
- `__tests__/client.test.ts`

**Modified (monorepo):**
- `.gitignore` — add `packages/*/dist/` and `packages/*/node_modules/` patterns (or rely on package-local `.gitignore`).
- `pnpm-workspace.yaml` — **no change** (the new package is independent; deliberately not a workspace package).

**Untouched:**
- `src/`, `__tests__/`, `Dockerfile`, `vite.config.ts`, `package.json` (parent) — all unchanged.

---

## Task 1: Scaffold `packages/liteparse-client/` with package metadata

**Files:**
- Create: `packages/liteparse-client/.gitignore`
- Create: `packages/liteparse-client/LICENSE`
- Create: `packages/liteparse-client/package.json`
- Create: `packages/liteparse-client/tsconfig.json`

- [ ] **Step 1: Create the directory structure**

Run:
```bash
mkdir -p packages/liteparse-client/src
mkdir -p packages/liteparse-client/__tests__
```

- [ ] **Step 2: Create `packages/liteparse-client/.gitignore`**

Write the following content:

```gitignore
node_modules/
dist/
coverage/
*.log
.DS_Store
```

- [ ] **Step 3: Create `packages/liteparse-client/LICENSE`**

Write the standard MIT license text. Replace the year and copyright holder with the current year and `@falentio` (or the project owner; the year is 2026):

```
MIT License

Copyright (c) 2026 @falentio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Create `packages/liteparse-client/package.json`**

Write the following content:

```json
{
  "name": "@falentio/liteparse-client",
  "version": "0.1.0",
  "description": "WinterTC-compliant client for the liteparse-hono document parsing server",
  "type": "module",
  "license": "MIT",
  "engines": {
    "node": ">=22"
  },
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js"
    },
    "./test-utils": {
      "types": "./dist/test-utils.d.ts",
      "import": "./dist/test-utils.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "build:watch": "rollup -c -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^16.0.0",
    "@rollup/plugin-typescript": "^12.1.0",
    "rollup": "^4.30.0",
    "rollup-plugin-dts": "^6.2.0",
    "tslib": "^2.8.0",
    "typescript": "^6.0.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 5: Create `packages/liteparse-client/tsconfig.json`**

Write the following content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "noEmit": true
  },
  "include": ["src/**/*", "__tests__/**/*", "rollup.config.mjs", "vitest.config.ts"]
}
```

- [ ] **Step 6: Install the package's dev dependencies**

Run: `cd packages/liteparse-client && pnpm install`
Expected: `node_modules/` populated; `pnpm-lock.yaml` is created inside `packages/liteparse-client/`.

- [ ] **Step 7: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/.gitignore packages/liteparse-client/LICENSE packages/liteparse-client/package.json packages/liteparse-client/tsconfig.json packages/liteparse-client/pnpm-lock.yaml
git commit -m "chore(client): scaffold @falentio/liteparse-client package"
```

---

## Task 2: `Result<T, E>` type

**Files:**
- Create: `packages/liteparse-client/src/result.ts`
- Create: `packages/liteparse-client/__tests__/result.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/result.test.ts`:

```ts
import { describe, it, expectTypeOf } from "vitest";
import { ok, err, type Result } from "../src/result";

describe("Result", () => {
  it("ok() constructs an ok result", () => {
    const r = ok("hello");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe("hello");
    } else {
      throw new Error("expected ok");
    }
  });

  it("err() constructs an err result", () => {
    const r = err({ kind: "network", cause: new Error("x") } as const);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("network");
    } else {
      throw new Error("expected err");
    }
  });

  it("narrows correctly via discriminator", () => {
    const r: Result<string, { kind: "x" }> = ok("v");
    if (r.ok) {
      expectTypeOf(r.value).toEqualTypeOf<string>();
    } else {
      expectTypeOf(r.error).toEqualTypeOf<{ kind: "x" }>();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/liteparse-client && pnpm test`
Expected: FAIL — `Cannot find module '../src/result'`.

- [ ] **Step 3: Implement `src/result.ts`**

Create `packages/liteparse-client/src/result.ts`:

```ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 3 `__tests__/result.test.ts` cases pass.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/result.ts packages/liteparse-client/__tests__/result.test.ts
git commit -m "feat(client): add Result<T, E> type with ok/err helpers"
```

---

## Task 3: `LiteparseError` union + factory helpers

**Files:**
- Create: `packages/liteparse-client/src/errors.ts`
- Create: `packages/liteparse-client/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/errors.test.ts`:

```ts
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  type LiteparseError,
  invalidInput,
  networkError,
  aborted,
  httpError,
  streamTokenError,
  decodeError,
} from "../src/errors";

describe("LiteparseError factories", () => {
  it("invalidInput produces kind: 'invalid_input'", () => {
    const e = invalidInput("filename required");
    expect(e.kind).toBe("invalid_input");
    if (e.kind === "invalid_input") {
      expect(e.message).toBe("filename required");
    }
  });

  it("networkError preserves cause", () => {
    const cause = new Error("ECONNREFUSED");
    const e = networkError(cause);
    expect(e.kind).toBe("network");
    if (e.kind === "network") {
      expect(e.cause).toBe(cause);
    }
  });

  it("aborted has no payload", () => {
    const e = aborted();
    expect(e.kind).toBe("aborted");
  });

  it("httpError carries status and detail", () => {
    const e = httpError(413, "File too large; max 30MB");
    expect(e.kind).toBe("http");
    if (e.kind === "http") {
      expect(e.status).toBe(413);
      expect(e.detail).toBe("File too large; max 30MB");
    }
  });

  it("streamTokenError carries the message", () => {
    const e = streamTokenError("tesseract not installed");
    expect(e.kind).toBe("stream_token");
    if (e.kind === "stream_token") {
      expect(e.message).toBe("tesseract not installed");
    }
  });

  it("decodeError carries a message", () => {
    const e = decodeError("invalid utf-8");
    expect(e.kind).toBe("decode");
  });

  it("LiteparseError is a discriminated union on kind", () => {
    type _Assert = Assert<LiteparseError, { kind: "x" }>;
    expectTypeOf<LiteparseError["kind"]>().toEqualTypeOf<
      "invalid_input" | "network" | "aborted" | "http" | "stream_token" | "decode"
    >();
  });
});

type Assert<T, U> = T extends U ? U extends T ? true : never : never;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../src/errors'`.

- [ ] **Step 3: Implement `src/errors.ts`**

Create `packages/liteparse-client/src/errors.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 7 `__tests__/errors.test.ts` cases pass.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/errors.ts packages/liteparse-client/__tests__/errors.test.ts
git commit -m "feat(client): add LiteparseError union and factory helpers"
```

---

## Task 4: `LiteParseConfig` mirror + input/option types

**Files:**
- Create: `packages/liteparse-client/src/types.ts`

(No tests for this task — types are validated through Task 7's client tests.)

- [ ] **Step 1: Read upstream types for the mirror**

Run: `cat node_modules/.pnpm/@llamaindex+liteparse@*/node_modules/@llamaindex/liteparse/dist/src/core/types.d.ts | head -100`

Use the output to write the mirror below. The mirror must stay in sync with upstream; the comment marks the source.

- [ ] **Step 2: Create `src/types.ts`**

Create `packages/liteparse-client/src/types.ts`:

```ts
// Hand-written mirror of LiteParseConfig from @llamaindex/liteparse.
// Source: node_modules/@llamaindex/liteparse/dist/src/core/types.d.ts
// Keep this in sync with upstream when bumping the peer version.
export interface LiteParseConfig {
  ocrLanguage: string | string[];
  ocrEnabled: boolean;
  ocrServerUrl?: string;
  tessdataPath?: string;
  numWorkers: number;
  targetPages?: string;
  dpi?: number;
  outputFormat?: "text" | "json";
  [key: string]: unknown;
}

export type ParseInput = File | Blob | ArrayBuffer | ArrayBufferView;

export interface ParseOptions {
  filename?: string;
  mimetype?: string;
  config?: Partial<LiteParseConfig>;
}

export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  stream: boolean;
  fetch?: typeof fetch;
}

const SUCCESS_PREFIX = "__SUCCESS__:";
const ERROR_PREFIX = "__ERROR__:";
const HEARTBEAT = " ";

export const tokens = {
  successPrefix: SUCCESS_PREFIX,
  errorPrefix: ERROR_PREFIX,
  heartbeat: HEARTBEAT,
} as const;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/types.ts
git commit -m "feat(client): add LiteParseConfig mirror and input/option types"
```

---

## Task 5: `toFormData()` input normalizer (TDD)

**Files:**
- Create: `packages/liteparse-client/src/fetch-input.ts`
- Create: `packages/liteparse-client/__tests__/fetch-input.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/fetch-input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toFormData } from "../src/fetch-input";

describe("toFormData — ArrayBuffer", () => {
  it("builds a multipart form with the file field and default filename", async () => {
    const bytes = new TextEncoder().encode("hello world").buffer;
    const fd = toFormData(bytes, "doc.bin", "application/octet-stream");
    const file = fd.get("file");
    expect(file).toBeInstanceOf(Blob);
    const blob = file as Blob;
    expect(blob.type).toBe("application/octet-stream");
    expect(await blob.text()).toBe("hello world");
  });
});

describe("toFormData — Uint8Array (Buffer)", () => {
  it("accepts ArrayBufferView", async () => {
    const view = new Uint8Array([72, 73]); // "HI"
    const fd = toFormData(view, "greet.bin", "application/octet-stream");
    const file = fd.get("file") as Blob;
    expect(await file.text()).toBe("HI");
  });
});

describe("toFormData — File", () => {
  it("uses the File's name and type as defaults", async () => {
    const file = new File(["abc"], "note.txt", { type: "text/plain" });
    const fd = toFormData(file);
    const f = fd.get("file") as File;
    expect(f.name).toBe("note.txt");
    expect(f.type).toBe("text/plain");
    expect(await f.text()).toBe("abc");
  });
});

describe("toFormData — Blob", () => {
  it("uses opts.mimetype when Blob has no type", async () => {
    const blob = new Blob(["xyz"]);
    const fd = toFormData(blob, "x.bin", "application/octet-stream");
    const f = fd.get("file") as Blob;
    expect(f.type).toBe("application/octet-stream");
    expect(await f.text()).toBe("xyz");
  });
});

describe("toFormData — config field", () => {
  it("appends a JSON-stringified config when provided", () => {
    const fd = toFormData(
      new Uint8Array([1, 2, 3]),
      "x.bin",
      "application/octet-stream",
      { targetPages: "1" },
    );
    expect(fd.get("config")).toBe('{"targetPages":"1"}');
  });

  it("omits the config field when not provided", () => {
    const fd = toFormData(
      new Uint8Array([1, 2, 3]),
      "x.bin",
      "application/octet-stream",
    );
    expect(fd.get("config")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../src/fetch-input'`.

- [ ] **Step 3: Implement `src/fetch-input.ts`**

Create `packages/liteparse-client/src/fetch-input.ts`:

```ts
import type { LiteParseConfig, ParseInput } from "./types.js";

export function toFormData(
  input: ParseInput,
  filename?: string,
  mimetype?: string,
  config?: Partial<LiteParseConfig>,
): FormData {
  const fd = new FormData();

  if (input instanceof File) {
    fd.append("file", input, input.name);
  } else if (input instanceof Blob) {
    const name = filename ?? "blob";
    fd.append("file", input, name);
  } else {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    const name = filename ?? "buffer.bin";
    const blob = new Blob([bytes], mimetype ? { type: mimetype } : undefined);
    fd.append("file", blob, name);
  }

  if (config !== undefined) {
    fd.append("config", JSON.stringify(config));
  }

  return fd;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 6 `__tests__/fetch-input.test.ts` cases pass.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/fetch-input.ts packages/liteparse-client/__tests__/fetch-input.test.ts
git commit -m "feat(client): add toFormData() input normalizer"
```

---

## Task 6: `readStreamBody()` reader (TDD)

**Files:**
- Create: `packages/liteparse-client/src/stream.ts`
- Create: `packages/liteparse-client/__tests__/stream.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/stream.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readStreamBody } from "../src/stream";
import { stringToReadableStream } from "../src/test-utils";

describe("readStreamBody", () => {
  it("returns ok with the text after __SUCCESS__: prefix", async () => {
    const body = stringToReadableStream("  __SUCCESS__:hello world  ");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hello world");
  });

  it("returns ok with the unprefixed text when no token is present (defensive)", async () => {
    const body = stringToReadableStream("  just plain text  ");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("just plain text");
  });

  it("returns err(kind: stream_token) for __ERROR__: prefix", async () => {
    const body = stringToReadableStream(" __ERROR__:tesseract crashed ");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "stream_token") {
      expect(r.error.message).toBe("tesseract crashed");
    } else {
      throw new Error("expected stream_token");
    }
  });

  it("strips heartbeats (single-space tokens) via trim", async () => {
    const body = stringToReadableStream("   __SUCCESS__:text here   ");
    const r = await readStreamBody(body);
    if (r.ok) expect(r.value).toBe("text here");
    else throw new Error("expected ok");
  });

  it("handles multi-chunk bodies", async () => {
    const body = stringToReadableStream("__SUCC", "ESS__:", "spanning chunks");
    const r = await readStreamBody(body);
    if (r.ok) expect(r.value).toBe("spanning chunks");
    else throw new Error("expected ok");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../src/stream'` and `'../src/test-utils'`.

- [ ] **Step 3: Implement `src/stream.ts`**

Create `packages/liteparse-client/src/stream.ts`:

```ts
import { ok, err, type Result } from "./result.js";
import { streamTokenError, decodeError } from "./errors.js";
import { tokens } from "./types.js";

export async function readStreamBody(
  body: ReadableStream<Uint8Array>,
): Promise<Result<string, { kind: "stream_token"; message: string } | { kind: "decode"; message: string }>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (done) break;
    }
    buffer += decoder.decode();
  } catch (cause) {
    return err(
      decodeError(cause instanceof Error ? cause.message : String(cause)),
    );
  } finally {
    reader.releaseLock();
  }

  const text = buffer.trim();

  if (text.startsWith(tokens.errorPrefix)) {
    return err(
      streamTokenError(text.slice(tokens.errorPrefix.length).trim()),
    );
  }
  if (text.startsWith(tokens.successPrefix)) {
    return ok(text.slice(tokens.successPrefix.length));
  }
  return ok(text);
}
```

- [ ] **Step 4: Implement minimal `src/test-utils.ts` (just `stringToReadableStream`)**

Create `packages/liteparse-client/src/test-utils.ts`:

```ts
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

export function mockFetch(
  handler: (req: Request) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    return handler(req);
  }) as typeof fetch;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 5 `__tests__/stream.test.ts` cases pass.

- [ ] **Step 6: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/stream.ts packages/liteparse-client/src/test-utils.ts packages/liteparse-client/__tests__/stream.test.ts
git commit -m "feat(client): add readStreamBody() reader and minimal test-utils"
```

---

## Task 7: `assertWinterTcGlobals()` (TDD)

**Files:**
- Create: `packages/liteparse-client/src/node.ts`
- Create: `packages/liteparse-client/__tests__/node.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/node.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assertWinterTcGlobals } from "../src/node";

describe("assertWinterTcGlobals", () => {
  it("throws when fetch is missing", () => {
    const saved = (globalThis as Record<string, unknown>).fetch;
    delete (globalThis as Record<string, unknown>).fetch;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/fetch/);
    } finally {
      (globalThis as Record<string, unknown>).fetch = saved;
    }
  });

  it("throws when ReadableStream is missing", () => {
    const saved = (globalThis as Record<string, unknown>).ReadableStream;
    delete (globalThis as Record<string, unknown>).ReadableStream;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/ReadableStream/);
    } finally {
      (globalThis as Record<string, unknown>).ReadableStream = saved;
    }
  });

  it("does not throw when all required globals are present (Node 22+)", () => {
    expect(() => assertWinterTcGlobals()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../src/node'`.

- [ ] **Step 3: Implement `src/node.ts`**

Create `packages/liteparse-client/src/node.ts`:

```ts
const REQUIRED = [
  "fetch",
  "ReadableStream",
  "Blob",
  "File",
  "FormData",
  "Request",
  "Response",
  "Headers",
  "TextEncoder",
  "TextDecoder",
  "URL",
  "URLSearchParams",
] as const;

export function assertWinterTcGlobals(): void {
  const missing: string[] = [];
  for (const name of REQUIRED) {
    if (typeof (globalThis as Record<string, unknown>)[name] === "undefined") {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required WinterTC globals on this runtime: ${missing.join(", ")}. ` +
        `Target Node 22+ (which ships these natively) or import a polyfill before using @falentio/liteparse-client.`,
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 3 `__tests__/node.test.ts` cases pass.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/node.ts packages/liteparse-client/__tests__/node.test.ts
git commit -m "feat(client): add assertWinterTcGlobals() for /node entry"
```

---

## Task 8: `LiteparseClient` class (TDD)

**Files:**
- Create: `packages/liteparse-client/src/client.ts`
- Create: `packages/liteparse-client/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/liteparse-client/__tests__/client.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LiteparseClient } from "../src/client";
import { mockFetch, stringToReadableStream, multipartRequestFromInput } from "../src/test-utils";

function makeClient(overrides: Partial<{ stream: boolean; apiKey: string; baseUrl: string; fetch: typeof fetch }> = {}) {
  return new LiteparseClient({
    baseUrl: overrides.baseUrl ?? "https://api.example.com",
    stream: overrides.stream ?? false,
    apiKey: overrides.apiKey,
    fetch: overrides.fetch,
  });
}

describe("LiteparseClient — non-stream", () => {
  it("sends multipart/form-data to /parse and returns the text", async () => {
    const fetchMock = mockFetch(async (req) => {
      expect(req.url).toBe("https://api.example.com/parse");
      expect(req.method).toBe("POST");
      expect(req.headers.get("content-type")?.startsWith("multipart/form-data")).toBe(true);
      return new Response("extracted text", { status: 200 });
    });
    const client = makeClient({ fetch: fetchMock });
    const result = await client.parse(new Uint8Array([1, 2, 3]), {
      filename: "doc.pdf",
      mimetype: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("extracted text");
  });

  it("attaches Authorization header when apiKey is set", async () => {
    let capturedAuth: string | null = null;
    const fetchMock = mockFetch(async (req) => {
      capturedAuth = req.headers.get("authorization");
      return new Response("", { status: 200 });
    });
    const client = makeClient({ apiKey: "secret-123", fetch: fetchMock });
    await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(capturedAuth).toBe("Bearer secret-123");
  });

  it("returns Result.err kind: http for 4xx responses with parsed detail", async () => {
    const fetchMock = mockFetch(async () =>
      new Response(
        JSON.stringify({ detail: "OCR is disabled; set LITEPARSE_OCR=true to enable" }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const client = makeClient({ fetch: fetchMock });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "http") {
      expect(result.error.status).toBe(400);
      expect(result.error.detail).toBe(
        "OCR is disabled; set LITEPARSE_OCR=true to enable",
      );
    } else {
      throw new Error("expected http error");
    }
  });

  it("returns Result.err kind: http for 4xx with non-JSON body", async () => {
    const fetchMock = mockFetch(async () =>
      new Response("not json", { status: 500 }),
    );
    const client = makeClient({ fetch: fetchMock });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "http") {
      expect(result.error.status).toBe(500);
      expect(result.error.detail).toBe("not json");
    } else {
      throw new Error("expected http error");
    }
  });

  it("returns Result.err kind: network when fetch throws", async () => {
    const fetchMock = mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const client = makeClient({ fetch: fetchMock });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "network") {
      expect((result.error.cause as Error).message).toBe("ECONNREFUSED");
    } else {
      throw new Error("expected network error");
    }
  });

  it("returns Result.err kind: aborted when AbortSignal fires", async () => {
    const fetchMock = mockFetch(async (req) => {
      req.signal.throwIfAborted();
      return new Response("never", { status: 200 });
    });
    const client = makeClient({ fetch: fetchMock });
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    }, ctrl.signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("aborted");
  });

  it("returns Result.err kind: invalid_input when filename is missing for ArrayBuffer", async () => {
    const client = makeClient();
    const result = await client.parse(new Uint8Array([0]), {
      mimetype: "application/octet-stream",
    } as Parameters<typeof client.parse>[1]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_input");
  });
});

describe("LiteparseClient — stream", () => {
  it("sends to /parse-stream and strips __SUCCESS__: prefix", async () => {
    const fetchMock = mockFetch(async (req) => {
      expect(req.url).toBe("https://api.example.com/parse-stream");
      return new Response(
        stringToReadableStream("   __SUCCESS__:streamed text   "),
      );
    });
    const client = makeClient({ stream: true, fetch: fetchMock });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("streamed text");
  });

  it("returns Result.err kind: stream_token on __ERROR__:", async () => {
    const fetchMock = mockFetch(async () =>
      new Response(stringToReadableStream(" __ERROR__:tesseract crashed ")),
    );
    const client = makeClient({ stream: true, fetch: fetchMock });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "stream_token") {
      expect(result.error.message).toBe("tesseract crashed");
    } else {
      throw new Error("expected stream_token");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../src/client'` and `'multipartRequestFromInput' is not exported from '../src/test-utils'`.

- [ ] **Step 3: Extend `src/test-utils.ts` with `multipartRequestFromInput`**

Replace the entire contents of `packages/liteparse-client/src/test-utils.ts` with:

```ts
import { toFormData } from "./fetch-input.js";
import type { LiteParseConfig, ParseInput, ParseOptions } from "./types.js";

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
  stream = false,
): Request {
  const path = stream ? "/parse-stream" : "/parse";
  const url = `${baseUrl}${path}`;
  const filename =
    input instanceof File ? input.name : (opts.filename ?? "buffer.bin");
  const mimetype =
    input instanceof File ? input.type : opts.mimetype;
  const fd = toFormData(input, filename, mimetype, opts.config as Partial<LiteParseConfig> | undefined);
  return new Request(url, { method: "POST", body: fd });
}
```

- [ ] **Step 4: Implement `src/client.ts`**

Create `packages/liteparse-client/src/client.ts`:

```ts
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
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.stream = opts.stream;
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: all 9 `__tests__/client.test.ts` cases pass; total suite green.

- [ ] **Step 6: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/client.ts packages/liteparse-client/src/test-utils.ts packages/liteparse-client/__tests__/client.test.ts
git commit -m "feat(client): add LiteparseClient with parse() and stream flag"
```

---

## Task 9: `src/index.ts` and `src/node.ts` exports

**Files:**
- Create: `packages/liteparse-client/src/index.ts`
- Modify: `packages/liteparse-client/src/node.ts` (add default export)

(No new tests; exports are exercised by Tasks 7 and 8.)

- [ ] **Step 1: Create `src/index.ts`**

Create `packages/liteparse-client/src/index.ts`:

```ts
export { LiteparseClient } from "./client.js";
export type { ClientOptions, ParseInput, ParseOptions, LiteParseConfig } from "./types.js";
export type { Result } from "./result.js";
export type { LiteparseError } from "./errors.js";
```

- [ ] **Step 2: Replace `src/node.ts` with a side-effect entrypoint**

Replace the entire contents of `packages/liteparse-client/src/node.ts` with:

```ts
import { assertWinterTcGlobals } from "./internals/winter-tc.js";
export { assertWinterTcGlobals } from "./internals/winter-tc.js";
assertWinterTcGlobals();
```

- [ ] **Step 3: Create `src/internals/winter-tc.ts`**

Create `packages/liteparse-client/src/internals/winter-tc.ts`:

```ts
const REQUIRED = [
  "fetch",
  "ReadableStream",
  "Blob",
  "File",
  "FormData",
  "Request",
  "Response",
  "Headers",
  "TextEncoder",
  "TextDecoder",
  "URL",
  "URLSearchParams",
] as const;

export function assertWinterTcGlobals(): void {
  const missing: string[] = [];
  for (const name of REQUIRED) {
    if (typeof (globalThis as Record<string, unknown>)[name] === "undefined") {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required WinterTC globals on this runtime: ${missing.join(", ")}. ` +
        `Target Node 22+ (which ships these natively) or import a polyfill before using @falentio/liteparse-client.`,
    );
  }
}
```

- [ ] **Step 4: Delete `__tests__/node.test.ts` and re-route to internals**

Move `packages/liteparse-client/__tests__/node.test.ts` → `packages/liteparse-client/__tests__/winter-tc.test.ts` and update the import to `"../src/internals/winter-tc"`.

Then re-run tests:

Run: `pnpm test`
Expected: all tests pass (including the renamed one).

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/src/index.ts packages/liteparse-client/src/node.ts packages/liteparse-client/src/internals/winter-tc.ts packages/liteparse-client/__tests__/winter-tc.test.ts
git mv packages/liteparse-client/__tests__/node.test.ts packages/liteparse-client/__tests__/winter-tc.test.ts 2>/dev/null || true
git add -A packages/liteparse-client/__tests__/
git commit -m "feat(client): wire main and /node exports, extract internals"
```

---

## Task 10: Rollup build configuration

**Files:**
- Create: `packages/liteparse-client/rollup.config.mjs`

- [ ] **Step 1: Create `rollup.config.mjs`**

Create `packages/liteparse-client/rollup.config.mjs`:

```mjs
import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";

const entries = [
  { input: "src/index.ts", file: "index.js" },
  { input: "src/node.ts", file: "node.js" },
  { input: "src/test-utils.ts", file: "test-utils.js" },
];

export default entries.flatMap((entry) => [
  {
    input: entry.input,
    output: {
      file: `dist/${entry.file}`,
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: {
          noEmit: false,
          declaration: false,
          declarationDir: undefined,
        },
      }),
    ],
  },
  {
    input: entry.input,
    output: {
      file: `dist/${entry.file.replace(".js", ".d.ts")}`,
      format: "esm",
    },
    plugins: [dts()],
  },
]);
```

- [ ] **Step 2: Install the rollup plugin dev deps**

Run: `cd packages/liteparse-client && pnpm add -D @rollup/plugin-typescript @rollup/plugin-node-resolve rollup-plugin-dts tslib`
Expected: `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: `dist/{index,node,test-utils}.js` and matching `.d.ts` files appear. No errors.

- [ ] **Step 4: Verify the build by re-running tests against the built bundle**

Create `packages/liteparse-client/__tests__/bundle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LiteparseClient } from "../dist/index.js";
import { mockFetch } from "../dist/test-utils.js";

describe("built bundle", () => {
  it("LiteparseClient is exported and constructs", () => {
    const c = new LiteparseClient({ baseUrl: "https://x.test", stream: false });
    expect(c).toBeInstanceOf(LiteparseClient);
  });

  it("mockFetch is exported and usable", async () => {
    const f = mockFetch(async () => new Response("ok", { status: 200 }));
    const res = await f("https://x.test/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
```

- [ ] **Step 5: Add `dist/**` to a separate test glob or exclude from main tests**

Open `packages/liteparse-client/vitest.config.ts` (create it now if it does not exist) with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
```

Run: `pnpm test`
Expected: all tests pass; the `bundle.test.ts` resolves the bundled `dist/` paths.

If `tsc --noEmit` complains about `import from "../dist/..."` (TS treats `.js` as ESM, must include `dist` in `tsconfig.json` `include` or use `// @ts-ignore`), relax the import: change `vitest.config.ts` `test.include` to `["__tests__/**/*.test.ts", "!__tests__/bundle.test.ts"]` and instead **manually verify** by running:

```bash
cd packages/liteparse-client
node --input-type=module -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
```

Expected output includes `LiteparseClient`.

If the bundle test approach is awkward, **delete `bundle.test.ts`** and rely on the manual `node -e` smoke check. The TypeScript build itself is the primary verification.

- [ ] **Step 6: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/rollup.config.mjs packages/liteparse-client/vitest.config.ts packages/liteparse-client/package.json packages/liteparse-client/pnpm-lock.yaml
git commit -m "build(client): add rollup config for ESM + dts outputs"
```

---

## Task 11: README and final polish

**Files:**
- Create: `packages/liteparse-client/README.md`

- [ ] **Step 1: Create `README.md`**

Create `packages/liteparse-client/README.md`:

````markdown
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
````

- [ ] **Step 2: Run final typecheck and tests**

Run: `cd packages/liteparse-client && pnpm typecheck && pnpm test`
Expected: typecheck exits 0; all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git add packages/liteparse-client/README.md
git commit -m "docs(client): add README with usage, errors, exports map"
```

---

## Task 12: Publish dry-run

**Files:** none modified.

- [ ] **Step 1: Run a publish dry-run**

Run: `cd packages/liteparse-client && pnpm pack`
Expected: a `.tgz` is created in `packages/liteparse-client/`.

- [ ] **Step 2: Inspect the package contents**

Run: `tar -tzf packages/liteparse-client/*.tgz | head -40`
Expected: includes `package/dist/{index,node,test-utils}.{js,d.ts}`, `package/LICENSE`, `package/README.md`, `package/package.json`. Excludes `node_modules/`, `src/`, `__tests__/`.

- [ ] **Step 3: Clean up the tarball**

Run: `rm packages/liteparse-client/*.tgz`

- [ ] **Step 4: Commit (no changes) — or skip if nothing to commit**

```bash
cd /home/kevin/Repositories/liteparse-hono
git status
```

If clean, no commit. If the tarball was accidentally tracked, ensure `.gitignore` covers it (already does via `*.tgz` if added, but not currently; not needed since we cleaned it up).

---

## Self-Review

**1. Spec coverage:**

| Requirement | Task |
|---|---|
| Package at `./packages/liteparse-client` | Task 1 |
| Handle API interaction | Task 8 |
| Handle `File`, `ArrayBuffer` (extended to `File \| Blob \| ArrayBuffer \| ArrayBufferView`) | Task 4 (types), Task 5 (normalizer), Task 8 (client) |
| Constructor `stream: boolean` (single `parse()` method) | Task 8 |
| Optimized for unit testing without real fetch (mock + ReadableStream from string) | Task 6 (test-utils + stream tests), Task 8 (client tests use `mockFetch`) |
| WinterTC target | Task 4 (types rely on web globals), Task 7 (feature-detect) |
| `@falentio/liteparse-client/node` polyfill entrypoint | Task 9 |
| Build tool: rollup | Task 10 |

**2. Placeholder scan:** No TBD/TODO markers. Every code step has a full code block. Every test has a full test case. `multipartRequestFromInput` is referenced in Task 8 tests and implemented in Task 8 Step 3.

**3. Type consistency:**
- `Result<T, E>` defined in Task 2 (src/result.ts), used by client/stream consistently.
- `LiteparseError` union defined in Task 3 (src/errors.ts); factory helpers from the same module are the only way error objects are constructed throughout Tasks 4–9.
- `ParseInput`, `ParseOptions`, `ClientOptions`, `LiteParseConfig` defined in Task 4 (src/types.ts); used by Tasks 5, 6, 7, 8.
- `tokens` constant from `types.ts` used by `stream.ts` for `successPrefix`/`errorPrefix` (Task 6). `heartbeat` is exported for completeness but is not used in code — callers can read it; the `readStreamBody` implementation uses `trim()` instead. This is a minor dead export; if you prefer, drop the `heartbeat` line in Task 4 Step 2.
- `assertWinterTcGlobals` defined in Task 7 (src/node.ts), moved to `src/internals/winter-tc.ts` in Task 9, and re-exported from `src/node.ts`. Tests move with it in Task 9 Step 4.
- `mockFetch`, `stringToReadableStream`, `bytesToReadableStream`, `multipartRequestFromInput` all exported from `src/test-utils.ts` and used by client tests (Task 8) and stream tests (Task 6).
