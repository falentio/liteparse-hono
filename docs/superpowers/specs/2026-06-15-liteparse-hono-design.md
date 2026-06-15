# liteparse-hono — design spec

**Date:** 2026-06-15
**Status:** Draft, awaiting review
**Repo:** `liteparse-hono` (parent), with `liteparse-server` (Express) as a transitional submodule

## Purpose

Rewrite the Express-based `liteparse-server` as a minimal Hono-on-Node.js server, dropping Redis caching, rate limiting, OpenTelemetry, the `/screenshots` endpoint, and Bun support. Keep `POST /parse` as the only endpoint, with API-key auth, a 30MB upload cap, and a health check. The Express version is kept as a submodule for reference and is deleted in a later release.

## Goals

- One endpoint (`POST /parse`) returning extracted text from an uploaded document.
- API-key authentication (env-var-based, optional in dev).
- 30MB cap on the uploaded file (rejects larger uploads with 413).
- A `/health` endpoint for liveness probing.
- Tests for the parse business logic (no HTTP-layer tests).
- Internal-only deployment; not published to npm.
- Built artifact is a single `dist/index.js` produced by Vite.

## Non-goals

- No `/screenshots` endpoint. (Can be added later as a separate route + business function.)
- No Redis cache, no rate limiting, no request-level metrics, no OpenTelemetry.
- No Bun runtime support. Node 22 LTS only.
- No CI workflows. No publishing to npm.
- No HTTP-layer tests. Business logic only.
- No npm publish workflow, no `files` whitelist, no `publishConfig`.

## Architecture

Two layers with a sharp boundary. The business logic knows nothing about HTTP, multipart, or content types. The HTTP layer knows nothing about parsing strategy, file format, or `@llamaindex/liteparse`.

```
┌────────────────────────────────────────────────────────────┐
│  HTTP layer (src/app.ts)                                   │
│  - Hono app factory                                        │
│  - Auth middleware (API key from LITEPARSE_API_KEY)        │
│  - Multipart parsing via Hono's built-in c.req.parseBody()    │
│    (provided by @hono/node-server); handler enforces 30MB     │
│    cap on the file field manually                             │
│  - Valibot validation via @hono/valibot-validator          │
│  - Content-Type, status codes, error responses             │
│  - Request lifecycle logging via @logtape/logtape          │
└────────────────────────┬───────────────────────────────────┘
                         │  { buffer, filename, mimetype, config }
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Business logic (src/parse.ts)                             │
│  - parse({ buffer, filename, mimetype, config })          │
│  - returns { text: string, durationMs: number }            │
│  - pure: no HTTP types, no logging side effects           │
└────────────────────────────────────────────────────────────┘
```

## File structure

```
liteparse-hono/
├── .gitignore                       # node_modules, dist, .env
├── .dockerignore                    # node_modules, src, __tests__, .git
├── .gitmodules                      # transitional submodule pointer
├── liteparse-server/                # transitional submodule (deleted later)
├── Dockerfile                       # multi-stage: build → runtime
├── package.json                     # private: true, scripts, deps
├── pnpm-lock.yaml
├── tsconfig.json                    # editor config only; noEmit
├── vite.config.ts                   # plain Vite SSR build with src/index.ts as entry
├── README.md
├── API_SPEC.md                      # one-section API doc
├── data/                            # test fixtures
│   ├── pe_deal_examples.pdf
│   ├── receipt.png
│   └── sample3.docx.doc
├── src/
│   ├── parse.ts                     # parse() business logic
│   ├── app.ts                       # Hono app factory + routes + middleware
│   ├── index.ts                     # entrypoint: configure() + serve()
│   ├── logger.ts                    # logtape configuration + getLogger
│   ├── middleware/
│   │   └── auth.ts                  # API-key auth middleware
│   └── schemas/
│       └── parse.ts                 # valibot schema for /parse form
├── __tests__/
│   ├── parse.test.ts                # 6 vitest cases for parse()
│   └── logger.test.ts               # optional; only if logtape setup is non-trivial
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-15-liteparse-hono-design.md   # this file
```

## Data flow — `POST /parse`

1. Request arrives: `POST /parse` with `Content-Type: multipart/form-data`.
2. **Auth middleware** reads `process.env.LITEPARSE_API_KEY` once at startup.
   - Env var unset → auth disabled, single warning logged at boot.
   - Env var set → every request must include `Authorization: Bearer <key>` with a value that matches the env var under `crypto.timingSafeEqual`. Mismatch → 401 `{ detail: "Unauthorized" }`.
3. **Multipart parsing** via Hono's built-in `c.req.parseBody()` (provided by `@hono/node-server`). The handler manually enforces a 30MB cap on the `file` field after parsing. Oversize → 413 `{ detail: "File too large; max 30MB" }`.
4. **Valibot validation** of the form fields:
   - `file`: required, instance of `File` (web standard).
   - `config`: optional string; if present, must parse as JSON object (valibot `v.pipe(v.string(), v.parseJson(), v.object({...}))`).
5. Handler extracts `buffer = Buffer.from(await file.arrayBuffer())`, plus `filename = file.name`, `mimetype = file.type`.
6. Handler calls `parse({ buffer, filename, mimetype, config: parsedConfig })`.
7. **Business logic** (`src/parse.ts`):
   - Constructs `new LiteParse(config).parse(buffer, true)`.
   - Returns `{ text: result.text, durationMs: elapsed }`.
8. Handler logs `info("Completed in {durationMs}ms", { durationMs, filename, sizeBytes })`.
9. Handler responds `200 text/plain` with the extracted text body.
10. Errors are caught by `app.onError()` and returned as `500 { detail: "..." }` with the error logged at `error` level.

## Endpoints

| Method | Path | Purpose | Auth | Responses |
|--------|------|---------|------|-----------|
| `POST` | `/parse` | Parse an uploaded document, return extracted text | Required (if env var set) | `200 text/plain`, `400`, `401`, `413`, `500` |
| `GET`  | `/health` | Liveness probe | Not required | `200 text/plain "OK"` |

### `POST /parse` — request

- `Content-Type: multipart/form-data`
- Form fields:
  - `file` (required, `File`) — the document to parse. Max 30MB.
  - `config` (optional, `string`) — JSON-serialized `Partial<LiteParseConfig>`.

### `POST /parse` — responses

- `200 text/plain` — extracted text, joined across pages.
- `400 { detail: string }` — missing `file`, malformed `config` JSON, or valibot validation failure.
- `401 { detail: "Unauthorized" }` — auth enabled and missing/wrong API key.
- `413 { detail: "File too large; max 30MB" }` — file exceeds 30MB cap.
- `500 { detail: string }` — internal parse failure (caught by `app.onError`).

## Components

### `src/parse.ts` — business logic

```ts
import { LiteParse, type LiteParseConfig, type ParsedPage } from "@llamaindex/liteparse";

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

### `src/schemas/parse.ts` — valibot schema

```ts
import * as v from "valibot";

const LiteParseConfigShape = v.object({ /* mirrored from @llamaindex/liteparse */ });
type LiteParseConfigShape = v.InferOutput<typeof LiteParseConfigShape>;

export const parseFormSchema = v.object({
  file: v.file(),  // valibot 1.x has v.file() for File validation
  config: v.optional(v.pipe(v.string(), v.parseJson(), LiteParseConfigShape)),
});
```

Note: the actual valibot schema for `LiteParseConfig` must mirror the upstream type. If the shape is open (i.e. any object allowed), use `v.record(v.string(), v.unknown())` or a permissive schema. To be confirmed during implementation by inspecting `@llamaindex/liteparse`'s `LiteParseConfig` type.

### `src/middleware/auth.ts` — API-key auth

```ts
import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";

const envKey = process.env.LITEPARSE_API_KEY;

export const authMiddleware = createMiddleware(async (c, next) => {
  if (!envKey) {
    return next();  // dev mode: auth disabled
  }
  const header = c.req.header("Authorization") ?? "";
  const expected = `Bearer ${envKey}`;
  if (header.length !== expected.length) {
    return c.json({ detail: "Unauthorized" }, 401);
  }
  const ok = timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) {
    return c.json({ detail: "Unauthorized" }, 401);
  }
  return next();
});
```

### `src/logger.ts` — logtape configuration

```ts
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

const level = (process.env.LOG_LEVEL ?? "info") as
  | "debug" | "info" | "warning" | "error" | "fatal";

let configured = false;
export async function configureLogger() {
  if (configured) return;
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      { category: ["liteparse", "server"], lowestLevel: level, sinks: ["console"] },
    ],
  });
  if (!process.env.LITEPARSE_API_KEY) {
    getLogger(["liteparse", "server"]).warn(
      "LITEPARSE_API_KEY not set — running unauthenticated",
    );
  }
  configured = true;
}

export const serverLogger = () => getLogger(["liteparse", "server"]);
```

### `src/app.ts` — Hono app factory

```ts
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { parseFormSchema } from "./schemas/parse";
import { valibot } from "@hono/valibot-validator";
import { parse } from "./parse";
import { serverLogger } from "./logger";

export function createApp() {
  const app = new Hono();
  app.use("*", authMiddleware);

  app.get("/health", (c) => c.text("OK"));

  app.post(
    "/parse",
    valibot("form", parseFormSchema),
    async (c) => {
      const form = c.req.valid("form");
      const buffer = Buffer.from(await form.file.arrayBuffer());
      const result = await parse({
        buffer,
        filename: form.file.name,
        mimetype: form.file.type,
        config: form.config,
      });
      serverLogger().info("Completed in {durationMs}ms", {
        durationMs: result.durationMs,
        filename: form.file.name,
        sizeBytes: buffer.length,
      });
      return c.text(result.text);
    },
  );

  app.onError((err, c) => {
    serverLogger().error("Request failed: {message}", { message: String(err) });
    return c.json({ detail: err.message }, 500);
  });

  return app;
}
```

### `src/index.ts` — entrypoint

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { configureLogger } from "./logger";

const port = Number(process.env.PORT ?? 5707);

await configureLogger();
serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`liteparse-hono listening on http://localhost:${info.port}`);
});
```

### `vite.config.ts` — build config

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

We use plain Vite SSR build with `src/index.ts` as the entry. Output is `dist/index.js` (a single ESM bundle), started by `node dist/index.js` in the Dockerfile runtime stage. This gives us full control over the entry: `src/index.ts` calls `serve({ ..., port: Number(process.env.PORT) ?? 5707 })` at top level with a runtime `PORT` env var, and calls `configureLogger()` first.

We deliberately do **not** use `@hono/vite-build/node`: that plugin auto-injects `serve()` and bakes the port at build time, and requires `src/index.ts` to default-export a Hono app (it then registers `.fetch` on its own internal app). That model is incompatible with our runtime `PORT` requirement and with calling `configureLogger()` before `serve()` at top level.

### `Dockerfile` — multi-stage

```dockerfile
# Build stage
FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
EXPOSE 5707
CMD ["node", "dist/index.js"]
```

### `package.json` scripts

```json
{
  "name": "liteparse-hono",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "devEngines": { "packageManager": { "name": "pnpm", "version": "^11.5.0" } },
  "scripts": {
    "dev": "watchexec -e ts -- vite-node src/index.ts",
    "build": "vite build",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Testing

Six vitest cases in `__tests__/parse.test.ts`, calling `parse()` directly with `Buffer` inputs. No HTTP, no supertest, no `@hono/testing`, no `app.fetch()`. The logtape is not configured in tests (logs are silent, which is fine — we don't assert on logs).

| # | Fixture | Config | Assertion |
|---|---------|--------|-----------|
| 1 | `pe_deal_examples.pdf` | none | text contains "AlphaFlex Packaging Group" and "Veridian Health Technologies" |
| 2 | `pe_deal_examples.pdf` | `{ targetPages: "1" }` | text contains "AlphaFlex", does not contain "Veridian" |
| 3 | `receipt.png` | none | text contains "Article Count Amount Tax" |
| 4 | `receipt.png` | `{ dpi: 200 }` | text contains "Article Count Amount Tax" |
| 5 | `sample3.docx.doc` | none | text contains both DOCX expected snippets |
| 6 | `sample3.docx.doc` | `{ targetPages: "2" }` | text contains only the second-page snippet |

## Environment variables

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| `PORT` | no | `5707` | HTTP port the server binds. |
| `LITEPARSE_API_KEY` | no | unset | If set, all routes (except `/health`) require `Authorization: Bearer <key>`. If unset, auth is disabled and a warning is logged. |
| `LOG_LEVEL` | no | `info` | One of `debug`, `info`, `warning`, `error`, `fatal`. |

## Open questions for the implementation plan

These do not block the spec; the plan will resolve them.

- Exact version pins for new dependencies: `@hono/node-server`, `@logtape/logtape`, `vite-node`, plus confirming the existing `hono`, `vite`, `vitest`, `typescript`, `valibot`, `@hono/valibot-validator` versions are mutually compatible. Note: `@hono/node-multipart` does not exist (Hono parses multipart natively via `c.req.parseBody()`), `watchexec` is a Rust CLI installed as a system binary (not via pnpm), and `@hono/vite-build/node` is intentionally not used (its auto-injected `serve()` + build-time port is incompatible with our runtime `PORT` env var).
- The valibot schema for `config`: whether to mirror the upstream `LiteParseConfig` shape strictly (rejects unknown keys) or accept any object (passes the parsed JSON through to LiteParse, which validates internally).
- Whether to keep `tsconfig.json` from the existing parent or write a new one (likely the latter, with `"strict": true`, `"noUncheckedIndexedAccess": true`, mirroring the old repo's strictness).
- Whether to include a `.dockerignore` (recommended; mirrors `.gitignore` plus `src/`, `__tests__/`, `.git`).
- Whether to add an `__tests__/logger.test.ts` (probably not — logtape is a trusted dep).

## Cascades

### Deleted from `liteparse-server` (submodule) on rewrite completion

- `src/cache.ts` (168 lines) — Redis cache, gone.
- `src/rate-limit.ts` (71 lines) — Redis rate limiter, gone.
- `src/telemetry.ts` (103 lines) — OpenTelemetry metrics, gone.
- `src/instrumentation.ts` (20 lines) — OTel SDK preload, gone.
- `src/slim.ts` (135 lines) — minimal Express variant, replaced by Hono app.
- `src/run.ts` (7 lines) — slim entrypoint, replaced.
- `src/utils.ts` (136 lines) — split into `src/parse.ts` (new file in parent).
- `src/index.ts` (239 lines) — full Express server, replaced by Hono app.
- `__tests__/slim.test.ts` (201 lines) — Hono-layer tests not ported.
- `__tests__/cache.test.ts` (12KB) — Redis tests, gone.
- `__tests__/logger.test.ts` — PrefixedLogger tests, gone.
- `__tests__/utils.test.ts` (270 lines) — ported to `__tests__/parse.test.ts` (6 cases vs original 13; 4 pages-mode cases and 3 unrelated cases dropped).
- `examples/docker-compose/` (full directory) — depended on Redis + OTel stack, gone.
- `slim.Dockerfile` (25 lines) — Bun-based slim image, gone.
- `slim-bunfig.toml` (23 lines) — Bun config, gone.
- `slim-bunfig.toml` references in old Dockerfiles — gone.
- `.github/workflows/` (4 files) — no CI.
- `bun.lock` (124KB) — replaced by `pnpm-lock.yaml`.
- The Express `package.json` content is fully replaced by the new one in the parent.

### Replaced in the parent

- `package.json`: filled in (was an empty stub with `pnpm devEngines`). Adds `"private": true`, `engines`, scripts, dependencies, description, keywords, author placeholder.
- `tsconfig.json`: rewritten for editor + `tsc --noEmit` typecheck (was absent).
- `vite.config.ts`: new.
- `Dockerfile`: new (multi-stage).
- `README.md`: new.
- `API_SPEC.md`: shrinks to one section (`POST /parse`); `/screenshots` section deleted; 429 row deleted.
- `.gitignore`: new (was absent).
- `.dockerignore`: new (was absent).

### Created in the parent

- `src/parse.ts`, `src/app.ts`, `src/index.ts`, `src/logger.ts`, `src/middleware/auth.ts`, `src/schemas/parse.ts`.
- `__tests__/parse.test.ts` (and possibly `__tests__/logger.test.ts`).
- `docs/superpowers/specs/2026-06-15-liteparse-hono-design.md` (this file).
- `data/` — test fixtures already present in submodule; either copied to parent or referenced via relative paths.

## Follow-up (not in this spec)

- **Submodule deletion.** After the new server is in production for at least one release and proven stable, remove the `liteparse-server` submodule:
  - Remove the `.gitmodules` line and the `[submodule "liteparse-server"]` block from `.git/config`.
  - `git rm liteparse-server`.
  - Move any code that was referenced from the submodule into the parent (the `parse()` function in particular, plus test fixtures) before deletion.
  - This is a separate PR/spec; do not bundle with the rewrite.
