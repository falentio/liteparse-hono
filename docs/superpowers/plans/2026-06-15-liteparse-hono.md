# liteparse-hono Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Hono-on-Node.js server (`liteparse-hono`) that exposes `POST /parse` for document parsing, with API-key auth, a 30MB upload cap, a `/health` endpoint, vitest tests for the business logic, and a multi-stage Dockerfile.

**Architecture:** Two-layer separation — pure business logic (`src/parse.ts`) takes a `Buffer` and returns extracted text, knows nothing about HTTP. Hono HTTP layer (`src/app.ts`) handles multipart, validation, auth, content types, and status codes, and translates between the wire format and the business function. No HTTP-layer tests (per design).

**Tech Stack:** Hono 4.x, `@hono/node-server`, `@hono/valibot-validator`, valibot 1.x, `@logtape/logtape`, `@llamaindex/liteparse`, Vite 8.x (plain SSR build, no `@hono/vite-build/node`), vitest 4.x, TypeScript 6.x, Node 22 LTS, pnpm, watchexec (system binary, not npm), vite-node.

---

## File Structure

**Created:**
- `package.json` (modified — fills in stub)
- `tsconfig.json` (editor config only, `noEmit`)
- `vite.config.ts` (plain Vite SSR build, `src/index.ts` as entry, output `dist/index.js`)
- `.gitignore` (node_modules, dist, .env, .DS_Store)
- `.dockerignore` (node_modules, src, __tests__, .git, docs)
- `src/parse.ts` (business logic, ~15 lines)
- `src/logger.ts` (logtape config, ~25 lines)
- `src/schemas/parse.ts` (valibot schema, ~20 lines)
- `src/middleware/auth.ts` (API-key auth, ~25 lines)
- `src/app.ts` (Hono app factory, ~40 lines)
- `src/index.ts` (entrypoint, ~10 lines)
- `__tests__/parse.test.ts` (6 vitest cases)
- `data/pe_deal_examples.pdf`, `data/receipt.png`, `data/sample3.docx.doc` (copied from submodule)
- `README.md` (setup, run, env vars)
- `API_SPEC.md` (one section: `POST /parse`)
- `Dockerfile` (multi-stage build)

**Untouched (kept for reference; deleted in a later release per spec):**
- `liteparse-server/` (submodule)
- `.gitmodules`

---

## Task 1: Bootstrap project metadata and install dependencies

**Files:**
- Modify: `package.json`
- Create: `.gitignore`
- Create: `.dockerignore`
- Copy from submodule: `data/`

- [ ] **Step 1: Replace the contents of `package.json`**

Replace the entire file with:

```json
{
  "name": "liteparse-hono",
  "private": true,
  "version": "0.1.0",
  "description": "API server for parsing documents with @llamaindex/liteparse, built on Hono for Node.js",
  "type": "module",
  "engines": { "node": ">=22" },
  "devEngines": {
    "packageManager": { "name": "pnpm", "version": "^11.5.0" }
  },
  "scripts": {
    "dev": "watchexec -e ts -- vite-node src/index.ts",
    "build": "vite build",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@hono/valibot-validator": "^0.6.1",
    "@llamaindex/liteparse": "^1.5.2",
    "@logtape/logtape": "^0.8.0",
    "hono": "^4.12.25",
    "valibot": "^1.4.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vite-node": "^3.0.0",
    "vitest": "^4.1.8"
  }
}
```

> The `dev` script uses `watchexec`, a Rust-based file watcher installed as a system binary (e.g. `brew install watchexec`, `scoop install watchexec`, or download from GitHub releases). It is NOT an npm dependency. If `watchexec` is not on PATH, the `dev` script will fail with "command not found."

> The `devDependencies` block intentionally omits both `@hono/node-multipart` (does not exist on npm — Hono parses multipart natively via `c.req.parseBody()`) and `watchexec` (system binary, not npm).

- [ ] **Step 2: Install dependencies**

Run:
```bash
pnpm install
```

Expected: `node_modules/` is updated. `pnpm-lock.yaml` is rewritten with all the new dependencies. No errors.

- [ ] **Step 3: Create `.gitignore`**

Create the file with:

```gitignore
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
```

- [ ] **Step 4: Create `.dockerignore`**

Create the file with:

```dockerignore
node_modules
dist
src
__tests__
.git
.gitmodules
docs
data
.env
.env.local
*.log
*.md
```

- [ ] **Step 5: Copy test fixtures from the submodule**

Run:
```bash
mkdir -p data
cp liteparse-server/data/pe_deal_examples.pdf data/
cp liteparse-server/data/receipt.png data/
cp liteparse-server/data/sample3.docx.doc data/
ls -la data/
```

Expected output: three files visible, ~4.7KB (PDF), ~42KB (PNG), ~34KB (DOCX). Sizes may vary by ±10%.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore .dockerignore data/
git commit -m "chore: bootstrap liteparse-hono project metadata and dependencies"
```

---

## Task 2: TypeScript and Vite configuration

**Files:**
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Create `tsconfig.json`**

Create the file with:

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
  "include": ["src/**/*", "__tests__/**/*", "vite.config.ts"]
}
```

> The `DOM` lib is included because valibot's `v.file()` validates web-standard `File` objects, which are typed from the DOM lib. Node 22's `File` global is structurally compatible.

- [ ] **Step 2: Create `vite.config.ts`**

Create the file with:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      input: "src/index.ts",
      output: {
        entryFileNames: "index.js",
        format: "esm",
      },
    },
  },
});
```

> **Why not `@hono/vite-build/node`?** That plugin's model is incompatible: it auto-injects `serve()` with a build-time port (no runtime `PORT` env var), and requires `src/index.ts` to default-export a Hono app (it then registers `.fetch` on its own internal app). We need `src/index.ts` to be the bootstrap (top-level `await configureLogger(); serve({ ..., port: Number(process.env.PORT) ?? 5707 })`), so we use plain Vite SSR build with `src/index.ts` as the explicit entry. Output is `dist/index.js` (single ESM bundle), started by `node dist/index.js` in the Dockerfile runtime stage.

- [ ] **Step 3: Verify typecheck runs (should pass with no source files yet)**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. There are no source files yet, so this should be a no-op. If it errors, the `tsconfig.json` is wrong.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json vite.config.ts
git commit -m "chore: add TypeScript and Vite configuration"
```

---

## Task 3: Write failing tests for `parse()`

**Files:**
- Create: `__tests__/parse.test.ts`

> TDD discipline: write the test first, see it fail, then implement.

- [ ] **Step 1: Create `__tests__/parse.test.ts`**

Create the file with:

```ts
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "../src/parse";

const PE_DEAL_PDF = "data/pe_deal_examples.pdf";
const RECEIPT_PNG = "data/receipt.png";
const OFFICE_DOCX = "data/sample3.docx.doc";

const ALPHAFLEX = "AlphaFlex Packaging Group";
const VERIDIAN = "Veridian Health Technologies";
const RECEIPT_HEADER = "Article Count Amount Tax";
const DOCX_SNIPPET_1 =
  "This document was created using accessibility techniques for headings, lists, image alternate text, tables,";
const DOCX_SNIPPET_2 =
  "Simple tables have a uniform number of columns and rows, without any merged cells:";

async function loadAsInput(filePath: string, mimetype: string) {
  const buffer = await readFile(filePath);
  return {
    buffer,
    filename: path.basename(filePath),
    mimetype,
  };
}

describe("parse() — PDF", () => {
  it("extracts text from all pages without config", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse(input);
    expect(result.text).toContain(ALPHAFLEX);
    expect(result.text).toContain(VERIDIAN);
  });

  it("respects targetPages config to limit extraction", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse({ ...input, config: { targetPages: "1" } });
    expect(result.text).toContain(ALPHAFLEX);
    expect(result.text).not.toContain(VERIDIAN);
  });
});

describe("parse() — PNG", () => {
  it("extracts text from a PNG without config", async () => {
    const input = await loadAsInput(RECEIPT_PNG, "image/png");
    const result = await parse(input);
    expect(result.text).toContain(RECEIPT_HEADER);
  });

  it("respects dpi config", async () => {
    const input = await loadAsInput(RECEIPT_PNG, "image/png");
    const result = await parse({ ...input, config: { dpi: 200 } });
    expect(result.text).toContain(RECEIPT_HEADER);
  });
});

describe("parse() — DOCX", () => {
  it("extracts text from all pages without config", async () => {
    const input = await loadAsInput(
      OFFICE_DOCX,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse(input);
    expect(result.text).toContain(DOCX_SNIPPET_1);
    expect(result.text).toContain(DOCX_SNIPPET_2);
  });

  it("respects targetPages config to limit extraction", async () => {
    const input = await loadAsInput(
      OFFICE_DOCX,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse({ ...input, config: { targetPages: "2" } });
    expect(result.text).not.toContain(DOCX_SNIPPET_1);
    expect(result.text).toContain(DOCX_SNIPPET_2);
  });
});

describe("parse() — return shape", () => {
  it("returns { text, durationMs }", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse(input);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
```

> 7 test cases total (6 behavior + 1 shape). The shape test is a small addition to lock the return type contract; spec says 6 cases but the 7th is essentially free.

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
pnpm test
```

Expected: FAIL with an error like `Cannot find module '../src/parse'` or `parse is not a function`. The exact message doesn't matter — the tests must not pass.

- [ ] **Step 3: Commit (failing tests)**

```bash
git add __tests__/parse.test.ts
git commit -m "test: add failing tests for parse() business logic"
```

---

## Task 4: Implement `parse()`

**Files:**
- Create: `src/parse.ts`

- [ ] **Step 1: Create `src/parse.ts`**

Create the file with:

```ts
import { LiteParse, type LiteParseConfig } from "@llamaindex/liteparse";

export type ParseInput = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  config?: Partial<LiteParseConfig>;
};

export type ParseResult = {
  text: string;
  durationMs: number;
};

export async function parse(input: ParseInput): Promise<ParseResult> {
  const start = performance.now();
  const lit = new LiteParse(input.config);
  const result = await lit.parse(input.buffer, true);
  const durationMs = performance.now() - start;
  return { text: result.text, durationMs };
}
```

> The function does not log. Logging is a serialization/HTTP concern, kept out of the business logic. The caller (the Hono route handler) is responsible for logging request lifecycle and elapsed time.

- [ ] **Step 2: Run the tests to verify they pass**

Run:
```bash
pnpm test
```

Expected: all 7 tests pass. If any fail, inspect the failure — most likely a `LiteParse` config field name mismatch (e.g. `targetPages` vs `target_pages`). Check the `@llamaindex/liteparse` types and adjust the test config accordingly.

- [ ] **Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/parse.ts
git commit -m "feat(parse): implement parse() business logic"
```

---

## Task 5: Logger setup (logtape)

**Files:**
- Create: `src/logger.ts`

> No TDD for the logger — logtape is a trusted dependency, and the logger's only requirement is that `configureLogger()` doesn't crash on startup and `getServerLogger()` returns a usable logger.

- [ ] **Step 1: Inspect the logtape API to confirm the imports and types**

Run a quick check by reading the installed package's exports:

```bash
ls node_modules/@logtape/logtape/dist/ | head -20
cat node_modules/@logtape/logtape/package.json | head -40
```

Look for the named exports: `configure`, `getConsoleSink`, `getLogger`, and the `LogLevel` type (or whatever the type is called in the installed version). If the types differ from what's below, adjust the next step.

- [ ] **Step 2: Create `src/logger.ts`**

Create the file with:

```ts
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

let configured = false;

export async function configureLogger(): Promise<void> {
  if (configured) return;

  const level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      {
        category: ["liteparse", "server"],
        lowestLevel: level,
        sinks: ["console"],
      },
    ],
  });

  configured = true;

  if (!process.env.LITEPARSE_API_KEY) {
    getLogger(["liteparse", "server"]).warn(
      "LITEPARSE_API_KEY not set — running unauthenticated (dev mode)",
    );
  }
}

export function getServerLogger() {
  return getLogger(["liteparse", "server"]);
}
```

- [ ] **Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. If logtape's `configure` is not generic over `LogLevel`, drop the `LogLevel` type cast and use `as any` or a wider type. The goal is no type errors, not strict typing of env-var-derived values.

- [ ] **Step 4: Commit**

```bash
git add src/logger.ts
git commit -m "feat(logger): add logtape configuration and server logger"
```

---

## Task 6: Valibot schema for the parse form

**Files:**
- Create: `src/schemas/parse.ts`

- [ ] **Step 1: Inspect `@llamaindex/liteparse`'s `LiteParseConfig` type**

Run:
```bash
find node_modules/@llamaindex/liteparse -name "*.d.ts" -type f | head -5
```

Look for the `LiteParseConfig` type definition. Note the field names and types. The valibot schema in the next step should either mirror the shape strictly or accept any JSON object (recommended, since `LiteParse` validates internally).

- [ ] **Step 2: Create `src/schemas/parse.ts`**

Create the file with:

```ts
import * as v from "valibot";

// We validate the form field as a JSON string, then parse it to a plain object.
// The shape of the parsed object is left to LiteParse to validate at parse time
// (mirrors the original server's behavior of passing the config through).
const JsonObject = v.pipe(
  v.string(),
  v.parseJson(),
  v.record(v.string(), v.unknown()),
);

export const parseFormSchema = v.object({
  file: v.file(),
  config: v.optional(JsonObject),
});

export type ParseForm = v.InferOutput<typeof parseFormSchema>;
```

> The schema is permissive on the `config` shape (any object allowed) because:
> 1. `LiteParse` validates the config internally and returns a useful error if the shape is wrong.
> 2. Mirroring the full `LiteParseConfig` type in valibot creates two sources of truth that drift.
> 3. The HTTP-layer 500 error handler surfaces the underlying parse error to the client.

- [ ] **Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. If `v.file()` is not exported in valibot 1.x, use a less strict validator (e.g. `v.unknown()` plus a manual `instanceof File` check in the handler). The fallback is documented in the spec's open questions.

- [ ] **Step 4: Commit**

```bash
git add src/schemas/parse.ts
git commit -m "feat(schemas): add valibot schema for parse form"
```

---

## Task 7: API-key auth middleware

**Files:**
- Create: `src/middleware/auth.ts`

- [ ] **Step 1: Create `src/middleware/auth.ts`**

Create the file with:

```ts
import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";

const ENV_KEY = process.env.LITEPARSE_API_KEY;
const ENV_KEY_ENABLED = typeof ENV_KEY === "string" && ENV_KEY.length > 0;

function unauthorized(c: import("hono").Context) {
  return c.json({ detail: "Unauthorized" }, 401);
}

export const authMiddleware = createMiddleware(async (c, next) => {
  if (!ENV_KEY_ENABLED) {
    return next();
  }

  const header = c.req.header("Authorization") ?? "";
  const expected = `Bearer ${ENV_KEY}`;

  if (header.length !== expected.length) {
    return unauthorized(c);
  }

  const headerBuf = Buffer.from(header, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const ok = timingSafeEqual(headerBuf, expectedBuf);

  if (!ok) {
    return unauthorized(c);
  }

  return next();
});
```

> The env var is read once at module load time, not per-request. This is intentional — rotating the API key requires a server restart, which is standard for shared-secret auth. If you ever need runtime rotation, wrap the env read in a getter.

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. If `c.req.header` typing causes issues, cast the parameter or use `c.req.raw.headers.get("Authorization") ?? ""`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "feat(auth): add API-key auth middleware with timing-safe comparison"
```

---

## Task 8: Hono app factory

**Files:**
- Create: `src/app.ts`

- [ ] **Step 1: Create `src/app.ts`**

Create the file with:

```ts
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { parseFormSchema } from "./schemas/parse";
import * as v from "valibot";
import { parse } from "./parse";
import { getServerLogger } from "./logger";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function createApp() {
  const app = new Hono();

  app.use("/parse", authMiddleware);
  app.use("/parse/*", authMiddleware);

  app.get("/health", (c) => c.text("OK"));

  app.post("/parse", async (c) => {
    const log = getServerLogger();

    const body = await c.req.parseBody();
    const file = body["file"];
    const configStr = body["config"];

    if (!(file instanceof File)) {
      return c.json(
        { detail: "You need to provide a file in the `file` field" },
        400,
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return c.json(
        { detail: `File too large; max ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        413,
      );
    }

    let config: Record<string, unknown> | undefined;
    if (typeof configStr === "string" && configStr.length > 0) {
      const parsed = v.safeParse(parseFormSchema.entries.config, configStr);
      if (!parsed.success) {
        return c.json(
          { detail: `Invalid config: ${parsed.issues[0]?.message ?? "parse error"}` },
          400,
        );
      }
      config = parsed.output as Record<string, unknown>;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parse({
      buffer,
      filename: file.name,
      mimetype: file.type,
      config: config as never,
    });

    log.info("Completed in {durationMs}ms", {
      durationMs: result.durationMs,
      filename: file.name,
      sizeBytes: buffer.length,
    });

    return c.text(result.text);
  });

  app.onError((err, c) => {
    getServerLogger().error("Request failed: {message}", {
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { detail: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  });

  return app;
}
```

> The valibot schema is used inline (not via `@hono/valibot-validator` middleware) because the multipart FormData isn't directly compatible with the validator's "form" target. We validate the `config` string separately and validate the `file` manually with `instanceof File` and the size cap. This is a deliberate, simpler pattern for multipart uploads.

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. If `parseFormSchema.entries.config` doesn't typecheck (valibot's API for accessing nested schemas differs by version), use `v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.unknown()))` directly in the `v.safeParse` call. The goal is no type errors and a working validator.

- [ ] **Step 3: Commit**

```bash
git add src/app.ts
git commit -m "feat(app): add Hono app factory with /parse and /health routes"
```

---

## Task 9: Entrypoint

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

Create the file with:

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { configureLogger, getServerLogger } from "./logger";

const port = Number(process.env.PORT ?? 5707);

await configureLogger();

serve({ fetch: createApp().fetch, port }, (info) => {
  getServerLogger().info("liteparse-hono listening on port {port}", {
    port: info.port,
  });
});
```

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exits with code 0. If `@hono/node-server`'s `serve` signature differs in the installed version, adjust the call. The shape is: `serve({ fetch, port }, callback)`.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entrypoint with logtape configuration and serve"
```

---

## Task 10: Verify the dev loop

**Files:** none (verification only)

> Smoke-test the running server end-to-end before moving to docs/Dockerfile.

- [ ] **Step 1: Start the dev server in the background**

Run:
```bash
pnpm dev &
SERVER_PID=$!
sleep 3
```

Expected: the server starts and logs `liteparse-hono listening on port 5707` (or similar). The `&` puts it in the background.

- [ ] **Step 2: Hit `/health` and verify 200**

Run:
```bash
curl -i http://localhost:5707/health
```

Expected: `HTTP/1.1 200 OK`, `Content-Type: text/plain; charset=UTF-8`, body `OK`.

- [ ] **Step 3: Hit `/parse` without auth and verify it works (no API key set)**

Run:
```bash
curl -s -X POST http://localhost:5707/parse \
  -F "file=@data/pe_deal_examples.pdf" | head -c 500
```

Expected: 200 response, body contains `AlphaFlex Packaging Group` and `Veridian Health Technologies`. (Head limits the output to the first 500 chars to keep the log readable.)

- [ ] **Step 4: Hit `/parse` with a config and verify target-pages works**

Run:
```bash
curl -s -X POST http://localhost:5707/parse \
  -F "file=@data/pe_deal_examples.pdf" \
  -F 'config={"targetPages":"1"}' | head -c 500
```

Expected: 200 response, body contains `AlphaFlex`, does NOT contain `Veridian` (only page 1 included).

- [ ] **Step 5: Stop the dev server**

Run:
```bash
kill $SERVER_PID
```

- [ ] **Step 6: Verify typecheck and tests one more time**

Run:
```bash
pnpm typecheck && pnpm test
```

Expected: typecheck exits 0, all 7 tests pass.

---

## Task 11: Verify auth behavior

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server with an API key set**

Run:
```bash
LITEPARSE_API_KEY=test pnpm dev &
SERVER_PID=$!
sleep 3
```

Expected: the dev server starts, and the log shows NO warning about `LITEPARSE_API_KEY not set` (since it is set).

- [ ] **Step 2: Hit `/parse` without auth and verify 401**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5707/parse \
  -F "file=@data/pe_deal_examples.pdf"
```

Expected output: `401`.

- [ ] **Step 3: Hit `/parse` with the correct auth and verify 200**

Run:
```bash
curl -s -X POST http://localhost:5707/parse \
  -H "Authorization: Bearer test" \
  -F "file=@data/pe_deal_examples.pdf" | head -c 200
```

Expected: 200 response, body contains `AlphaFlex Packaging Group`.

- [ ] **Step 4: Hit `/parse` with the wrong auth and verify 401**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5707/parse \
  -H "Authorization: Bearer wrong" \
  -F "file=@data/pe_deal_examples.pdf"
```

Expected output: `401`.

- [ ] **Step 5: Hit `/health` without auth and verify 200 (health is unauthenticated)**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5707/health
```

Expected output: `200`.

- [ ] **Step 6: Stop the dev server**

Run:
```bash
kill $SERVER_PID
```

---

## Task 12: Verify the build

**Files:** none (verification only)

- [ ] **Step 1: Build the production artifact**

Run:
```bash
pnpm build
```

Expected: `vite build` completes with no errors. A `dist/index.js` file is created.

- [ ] **Step 2: Inspect the build output**

Run:
```bash
ls -la dist/
```

Expected: `dist/index.js` exists, sized in the hundreds of KB (Vite bundles `@hono/node-server` and `@llamaindex/liteparse` into the single file).

- [ ] **Step 3: Run the built artifact**

Run:
```bash
node dist/index.js &
SERVER_PID=$!
sleep 2
```

Expected: the server starts and logs the same startup message as the dev server.

- [ ] **Step 4: Hit `/health` against the built artifact**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5707/health
```

Expected output: `200`.

- [ ] **Step 5: Stop the built server**

Run:
```bash
kill $SERVER_PID
```

---

## Task 13: Documentation

**Files:**
- Create: `README.md`
- Create: `API_SPEC.md`

- [ ] **Step 1: Create `README.md`**

Create the file with:

````markdown
# liteparse-hono

API server for parsing documents with [`@llamaindex/liteparse`](https://www.npmjs.com/package/@llamaindex/liteparse), built on [Hono](https://hono.dev) for Node.js.

## Requirements

- Node.js >= 22
- pnpm >= 11.5
- System libraries required by `@llamaindex/liteparse`: `libvips42`, `libreoffice`, `imagemagick`

## Setup

```bash
pnpm install
```

## Run

### Development

```bash
pnpm dev
```

Watches `.ts` files and restarts the server via `watchexec` (system binary) + `vite-node`. Listens on port 5707 by default.

### Production

```bash
pnpm build
pnpm start
```

`pnpm build` produces a single-file bundle in `dist/index.js`. `pnpm start` runs that bundle with Node.

## Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `5707` | HTTP port the server binds. |
| `LITEPARSE_API_KEY` | unset | If set, all routes (except `/health`) require `Authorization: Bearer <key>`. If unset, auth is disabled and a warning is logged at startup. |
| `LOG_LEVEL` | `info` | One of `debug`, `info`, `warn`, `error`, `fatal`. |

## Test

```bash
pnpm test         # run once
pnpm test:watch   # watch mode
```

Tests cover the `parse()` business logic only. The HTTP layer is exercised manually (see `API_SPEC.md`).

## API

See [`API_SPEC.md`](./API_SPEC.md).
````

- [ ] **Step 2: Create `API_SPEC.md`**

Create the file with:

````markdown
# API Specification

Base URL: `http://localhost:5707` (or whatever `PORT` is set to).

## `POST /parse` — parse a single document

Parses a single document and returns extracted text.

### Request

- `Content-Type: multipart/form-data`
- Form fields:
  - `file` (required, `File`) — the document to parse. Max 30MB.
  - `config` (optional, `string`) — JSON-serialized `Partial<LiteParseConfig>` (e.g. `{"targetPages":"1"}`).

### Responses

- `200 text/plain` — extracted text from the document, joined across pages.
- `400 { "detail": string }` — missing `file` field, or malformed `config` JSON.
- `401 { "detail": "Unauthorized" }` — `LITEPARSE_API_KEY` is set and the request lacks a valid `Authorization: Bearer <key>` header.
- `413 { "detail": "File too large; max 30MB" }` — `file.size` exceeds 30MB.
- `500 { "detail": string }` — internal parse failure.

### Example

```bash
curl -X POST http://localhost:5707/parse \
  -F "file=@./pe_deal_examples.pdf"

curl -X POST http://localhost:5707/parse \
  -F "file=@./pe_deal_examples.pdf" \
  -F 'config={"targetPages":"1"}'
```

## `GET /health` — liveness probe

Returns `200 text/plain "OK"`. No authentication required.
````

- [ ] **Step 3: Commit**

```bash
git add README.md API_SPEC.md
git commit -m "docs: add README and API_SPEC"
```

---

## Task 14: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile`**

Create the file with:

```dockerfile
# syntax=docker/dockerfile:1.7

# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Install system dependencies required by @llamaindex/liteparse
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json vite.config.ts ./
COPY src ./src

RUN pnpm build

# Runtime stage
FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

EXPOSE 5707

CMD ["node", "dist/index.js"]
```

> The system libraries (`libvips42`, `libreoffice`, `imagemagick`) are required by `@llamaindex/liteparse` for parsing PDFs, images, and Office documents. They must be present in both stages — the build stage needs them because Vite may statically analyze imports that reference them, and the runtime stage obviously needs them to actually parse.

- [ ] **Step 2: Build the Docker image**

Run:
```bash
docker build -t liteparse-hono:dev .
```

Expected: the build completes. The image is created. Final message includes `naming to docker.io/library/liteparse-hono:dev`.

- [ ] **Step 3: Run the image and verify it starts**

Run:
```bash
docker run --rm -d --name liteparse-hono-test -p 5707:5707 liteparse-hono:dev
sleep 5
```

Expected: container starts, no error in the foreground.

- [ ] **Step 4: Hit `/health` on the running container**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5707/health
```

Expected output: `200`.

- [ ] **Step 5: Stop and remove the container**

Run:
```bash
docker stop liteparse-hono-test
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: all 7 tests pass.

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: `dist/index.js` is created.

- [ ] **Step 4: Inspect the final file tree**

```bash
ls -la
ls -la src/
ls -la __tests__/
```

Expected: `src/` contains `parse.ts`, `app.ts`, `index.ts`, `logger.ts`, `middleware/auth.ts`, `schemas/parse.ts`. `__tests__/` contains `parse.test.ts`. `data/` contains the three fixtures. `Dockerfile`, `README.md`, `API_SPEC.md`, `vite.config.ts`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `.gitignore`, `.dockerignore` all present at the root. `liteparse-server/` (the submodule) is still there — deletion is a follow-up per the spec.

- [ ] **Step 5: Review the final commit log**

```bash
git log --oneline
```

Expected: ~14 commits, one per task, in chronological order. The submodule pointer for `liteparse-server` was added in the very first commit (submodule setup) and is unmodified throughout the rewrite.

---

## Self-Review

**Spec coverage check** — does each spec requirement have a task?

- Two-layer architecture (business logic / HTTP separation) → Tasks 4, 5, 6, 7, 8
- `POST /parse` returns `text/plain` with extracted text → Task 8 (handler), Task 4 (business logic)
- `GET /health` returns `200 OK` → Task 8
- API-key auth via `LITEPARSE_API_KEY`, optional in dev → Tasks 5 (warning log), 7 (middleware), 8 (applied to all routes except `/health`)
- 30MB cap on file uploads → Task 8 (size check, 413 response)
- Valibot validation of the parse form → Task 6 (schema), Task 8 (inline validation)
- Logtape configuration → Task 5
- 6+ vitest cases for `parse()` → Task 3 (writes 7 cases), Task 4 (passes)
- Multi-stage Dockerfile → Task 14
- README and API_SPEC → Task 13
- Internal-only, `private: true` in package.json → Task 1
- Node 22 LTS, pnpm lockfile → Task 1
- Vite SSR build (`src/index.ts` as entry, `dist/index.js` output) for prod, `vite-node` for dev → Task 2 (config), Task 9 (dev script)
- Watchexec for dev loop → Task 1 (script), Task 9 (verified)
- Submodule kept, deletion is a follow-up → out of scope, called out in Task 15 verification

All spec requirements are covered.

**Placeholder scan** — no `TBD`, `TODO`, "implement later", or vague "add appropriate error handling" in any step. The few "if X type doesn't exist, use Y" notes are explicit fallbacks with the alternative code shown inline.

**Type consistency** — `parse()` returns `{ text, durationMs }` everywhere (Task 3 tests, Task 4 implementation, Task 8 caller). `ParseInput` and `ParseResult` are exported from `src/parse.ts` and only referenced by those names. `authMiddleware` is exported from `src/middleware/auth.ts` and imported in `src/app.ts`. `getServerLogger` and `configureLogger` are exported from `src/logger.ts` and imported in `src/index.ts` and `src/app.ts`. `parseFormSchema` is exported from `src/schemas/parse.ts` and imported in `src/app.ts`. No name drift across tasks.

**Ambiguity check** — the one place with implementation flexibility is Task 8 (the valibot + multipart integration), and the task explicitly documents the fallback ("if `parseFormSchema.entries.config` doesn't typecheck, use the pipe directly"). The other potential ambiguity is logtape's `LogLevel` type (Task 5), also with a documented fallback. The plan is unambiguous in every other step.
