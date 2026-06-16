# parse-stream success token and env config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `__SUCCESS__:` token to `/parse-stream` for client-side consistency with the existing `__ERROR__:` token, make OCR enabling configurable via `LITEPARSE_OCR` (returning 400 instead of silently overriding), and make the upload size cap configurable via `LITEPARSE_MAX_SIZE_MB`.

**Architecture:** Pure env-parsing helpers live in a new `src/config.ts` module and are unit-tested directly. `parse-request.ts` calls these helpers to enforce the 400 (OCR conflict) and 413 (size cap) responses. `src/parse.ts` loses its `ocrEnabled` override entirely; the `parse()` business function passes config through unchanged. The `/parse-stream` handler in `src/app.ts` writes `__SUCCESS__:${result.text}` on success, mirroring the existing `__ERROR__:` shape.

**Tech Stack:** TypeScript 6.x, Hono 4.x, valibot 1.x, vitest 4.x, Node 22 LTS, pnpm.

---

## File Structure

**Created:**
- `src/config.ts` — pure env helpers: `isOcrAllowed()`, `getMaxSizeBytes()`, `getOcrConfigError()`. Reads `process.env` once at module load; throws at import-time if `LITEPARSE_MAX_SIZE_MB` is invalid.
- `__tests__/config.test.ts` — unit tests for all three helpers. Uses `vi.stubEnv` / `vi.unstubAllEnvs` to set/unset env per test.

**Modified:**
- `src/parse-request.ts:4,27-32,15` — `MAX_FILE_BYTES` constant removed; replaced by `getMaxSizeBytes()` import. New 400 branch from `getOcrConfigError` placed after the valibot parse, before the buffer read.
- `src/parse.ts` — `resolveConfig` function deleted; `parse()` passes `input.config` straight to `new LiteParse(...)`.
- `src/app.ts:71` — success-path write becomes `\`__SUCCESS__:${result.text}\``. Error path unchanged.
- `README.md:38-42` — env-var table gains `LITEPARSE_OCR` and `LITEPARSE_MAX_SIZE_MB` rows.
- `API_SPEC.md:13,21` — upload cap wording now reads "configurable via `LITEPARSE_MAX_SIZE_MB` (default 30)"; new 400 row for OCR conflict.

**Untouched:**
- `src/schemas/parse.ts` — no change; `config` schema stays open (passes any object through).
- `src/middleware/auth.ts`, `src/logger.ts`, `src/index.ts` — no change.
- `__tests__/parse.test.ts` — no change; existing 6 cases should keep passing once `resolveConfig` is removed (none of them pass `ocrEnabled`).
- `Dockerfile`, `vite.config.ts`, `tsconfig.json`, `package.json` — no change.

---

## Task 1: Add `src/config.ts` with env helpers (TDD)

**Files:**
- Create: `src/config.ts`
- Create: `__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/config.test.ts` with the following exact contents:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOcrAllowed, getMaxSizeBytes, getOcrConfigError } from "../src/config";

describe("isOcrAllowed", () => {
  afterEach(() => {
    delete process.env.LITEPARSE_OCR;
  });

  it("returns false when LITEPARSE_OCR is unset", () => {
    delete process.env.LITEPARSE_OCR;
    expect(isOcrAllowed()).toBe(false);
  });

  it('returns false when LITEPARSE_OCR="false"', () => {
    process.env.LITEPARSE_OCR = "false";
    expect(isOcrAllowed()).toBe(false);
  });

  it('returns true when LITEPARSE_OCR="true"', () => {
    process.env.LITEPARSE_OCR = "true";
    expect(isOcrAllowed()).toBe(true);
  });

  it('returns true when LITEPARSE_OCR="TRUE" (case-insensitive)', () => {
    process.env.LITEPARSE_OCR = "TRUE";
    expect(isOcrAllowed()).toBe(true);
  });

  it("returns false for any other value (strict truthy/falsy)", () => {
    process.env.LITEPARSE_OCR = "1";
    expect(isOcrAllowed()).toBe(false);
    process.env.LITEPARSE_OCR = "yes";
    expect(isOcrAllowed()).toBe(false);
    process.env.LITEPARSE_OCR = "";
    expect(isOcrAllowed()).toBe(false);
  });
});

describe("getOcrConfigError", () => {
  afterEach(() => {
    delete process.env.LITEPARSE_OCR;
  });

  it("returns null when OCR is allowed and user requests true", () => {
    process.env.LITEPARSE_OCR = "true";
    expect(getOcrConfigError({ ocrEnabled: true })).toBeNull();
  });

  it("returns null when OCR is disabled and user omits ocrEnabled", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ targetPages: "1" })).toBeNull();
  });

  it("returns null when OCR is disabled and user passes ocrEnabled=false", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ ocrEnabled: false })).toBeNull();
  });

  it("returns the disabled message when OCR is disabled and user passes ocrEnabled=true", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ ocrEnabled: true })).toBe(
      "OCR is disabled; set LITEPARSE_OCR=true to enable",
    );
  });

  it("returns the disabled message when LITEPARSE_OCR=false and user passes ocrEnabled=true", () => {
    process.env.LITEPARSE_OCR = "false";
    expect(getOcrConfigError({ ocrEnabled: true })).toBe(
      "OCR is disabled; set LITEPARSE_OCR=true to enable",
    );
  });

  it("returns null when config is undefined", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError(undefined)).toBeNull();
  });
});

describe("getMaxSizeBytes", () => {
  const original = process.env.LITEPARSE_MAX_SIZE_MB;

  beforeEach(() => {
    delete process.env.LITEPARSE_MAX_SIZE_MB;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LITEPARSE_MAX_SIZE_MB;
    } else {
      process.env.LITEPARSE_MAX_SIZE_MB = original;
    }
  });

  it("returns 30 * 1024 * 1024 when LITEPARSE_MAX_SIZE_MB is unset", () => {
    expect(getMaxSizeBytes()).toBe(30 * 1024 * 1024);
  });

  it("returns env value * 1024 * 1024 when LITEPARSE_MAX_SIZE_MB is set", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "50";
    expect(getMaxSizeBytes()).toBe(50 * 1024 * 1024);
  });

  it("accepts small positive values", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "1";
    expect(getMaxSizeBytes()).toBe(1024 * 1024);
  });
});
```

Note: we do not test the "throws on invalid value" behavior in this unit test file because that would crash the importer mid-suite. Validation of throw-behavior is verified manually in Step 5. If you want it tested, mock by calling the internal validator function — not done here to keep helpers as a single export surface.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL with `Failed to resolve import "../src/config"` (file does not exist yet).

- [ ] **Step 3: Implement `src/config.ts`**

Create `src/config.ts` with the following exact contents:

```ts
function parseOcrEnv(): boolean {
  return process.env.LITEPARSE_OCR === "true";
}

function parseMaxSizeMb(): number {
  const raw = process.env.LITEPARSE_MAX_SIZE_MB;
  if (raw === undefined) {
    return 30;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `Invalid LITEPARSE_MAX_SIZE_MB=${JSON.stringify(raw)}: must be a positive integer in MB`,
    );
  }
  return n;
}

const MAX_SIZE_MB = parseMaxSizeMb();
const MB = 1024 * 1024;

export function isOcrAllowed(): boolean {
  return parseOcrEnv();
}

export function getMaxSizeBytes(): number {
  return MAX_SIZE_MB * MB;
}

export function getOcrConfigError(
  config: Record<string, unknown> | undefined,
): string | null {
  if (isOcrAllowed()) return null;
  if (config && config.ocrEnabled === true) {
    return "OCR is disabled; set LITEPARSE_OCR=true to enable";
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: all `__tests__/config.test.ts` cases pass. Existing `__tests__/parse.test.ts` cases still pass.

- [ ] **Step 5: Verify the fail-fast behavior manually**

Run: `LITEPARSE_MAX_SIZE_MB=abc pnpm dev` (or `node -e 'import("./src/config.ts")'` via `tsx`/`vite-node`).
Expected: process exits with an unhandled `Error: Invalid LITEPARSE_MAX_SIZE_MB="abc"`.

Then run: `LITEPARSE_MAX_SIZE_MB=0 pnpm dev`
Expected: exits with `Error: Invalid LITEPARSE_MAX_SIZE_MB="0"`.

Then run: `LITEPARSE_MAX_SIZE_MB=-1 pnpm dev`
Expected: exits with `Error: Invalid LITEPARSE_MAX_SIZE_MB="-1"`.

Then run: `pnpm dev` (env unset)
Expected: server starts normally on port 5707.

(Ctrl-C the dev server after each.)

- [ ] **Step 6: Commit**

```bash
git add src/config.ts __tests__/config.test.ts
git commit -m "feat: add env config helpers for OCR and max size"
```

---

## Task 2: Wire `parse-request.ts` to use the new helpers

**Files:**
- Modify: `src/parse-request.ts`

- [ ] **Step 1: Replace the import block and the `MAX_FILE_BYTES` constant**

In `src/parse-request.ts`, replace lines 1-4:

```ts
import * as v from "valibot";
import { parseFormSchema } from "./schemas/parse";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
```

with:

```ts
import * as v from "valibot";
import { parseFormSchema } from "./schemas/parse";
import { getMaxSizeBytes, getOcrConfigError } from "./config";
```

- [ ] **Step 2: Replace the size-cap check (lines 27-32)**

Replace:

```ts
  if (file.size > MAX_FILE_BYTES) {
    return c.json(
      { detail: `File too large; max ${MAX_FILE_BYTES / 1024 / 1024}MB` },
      413,
    );
  }
```

with:

```ts
  const maxBytes = getMaxSizeBytes();
  if (file.size > maxBytes) {
    return c.json(
      { detail: `File too large; max ${maxBytes / 1024 / 1024}MB` },
      413,
    );
  }
```

- [ ] **Step 3: Insert the OCR 400 check after the valibot parse**

In the same function, the `config` is assigned in the block at lines 34-48. Immediately after that block (after the closing `}` on line 48, before the `Buffer.from` call on line 50), insert:

```ts
  const ocrError = getOcrConfigError(config);
  if (ocrError) {
    return c.json({ detail: ocrError }, 400);
  }
```

- [ ] **Step 4: Verify the final shape of `parse-request.ts`**

Read `src/parse-request.ts`. The full file should now read:

```ts
import * as v from "valibot";
import { parseFormSchema } from "./schemas/parse";
import { getMaxSizeBytes, getOcrConfigError } from "./config";

export type ParsedRequest = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  config?: Record<string, unknown>;
};

export async function parseRequest(
  c: import("hono").Context,
): Promise<ParsedRequest | Response> {
  const body = await c.req.parseBody();
  const file = body["file"];
  const configStr = body["config"];

  if (!(file instanceof File)) {
    return c.json(
      { detail: "You need to provide a file in the `file` field" },
      400,
    );
  }

  const maxBytes = getMaxSizeBytes();
  if (file.size > maxBytes) {
    return c.json(
      { detail: `File too large; max ${maxBytes / 1024 / 1024}MB` },
      413,
    );
  }

  let config: Record<string, unknown> | undefined;
  if (typeof configStr === "string" && configStr.length > 0) {
    const parsed = v.safeParse(parseFormSchema.entries.config, configStr);
    if (!parsed.success) {
      return c.json(
        {
          detail: `Invalid config: ${
            parsed.issues[0]?.message ?? "parse error"
          }`,
        },
        400,
      );
    }
    config = parsed.output as Record<string, unknown>;
  }

  const ocrError = getOcrConfigError(config);
  if (ocrError) {
    return c.json({ detail: ocrError }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    buffer,
    filename: file.name,
    mimetype: file.type,
    config,
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass; `tsc --noEmit` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-request.ts
git commit -m "feat: enforce OCR and max-size config from env in parse-request"
```

---

## Task 3: Remove `resolveConfig` from `parse.ts`

**Files:**
- Modify: `src/parse.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/parse.ts` with:

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

- [ ] **Step 2: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all 6 existing `__tests__/parse.test.ts` cases pass; `tsc --noEmit` exits 0. (The tests do not pass `ocrEnabled`, so the removal of the silent override does not change their behavior.)

- [ ] **Step 3: Commit**

```bash
git add src/parse.ts
git commit -m "refactor: drop ocrEnabled override in parse() — enforced at HTTP layer"
```

---

## Task 4: Add `__SUCCESS__` token to `/parse-stream`

**Files:**
- Modify: `src/app.ts:71`

- [ ] **Step 1: Update the success-path write**

In `src/app.ts`, replace line 71:

```ts
          await w.write(result.text);
```

with:

```ts
          await w.write(`__SUCCESS__:${result.text}`);
```

Leave the error path (lines 82-84) and the heartbeat loop (lines 42-58) unchanged. The new format is: leading heartbeat spaces, then `__SUCCESS__:<text>` or `__ERROR__:<message>`. Clients match on the token prefix to find the body.

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass; `tsc --noEmit` exits 0.

- [ ] **Step 3: Manual smoke test**

Start the dev server: `pnpm dev`.

In a separate terminal:

```bash
curl -N -X POST http://localhost:5707/parse-stream \
  -F "file=@./data/pe_deal_examples.pdf"
```

Expected: response starts with one or more `" "` heartbeat spaces, then `__SUCCESS__:` followed by the extracted PDF text.

- [ ] **Step 4: Manual error-path test**

```bash
curl -N -X POST http://localhost:5707/parse-stream \
  -F "file=@nonexistent.pdf"
```

Expected: response starts with one or more `" "` heartbeat spaces, then `__ERROR__:<message>`. (The file will fail to load; whatever error `LiteParse` throws is the message.)

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat: prefix parse-stream success body with __SUCCESS__: token"
```

---

## Task 5: Update `README.md` and `API_SPEC.md`

**Files:**
- Modify: `README.md:38-42`
- Modify: `API_SPEC.md:13,21,19`

- [ ] **Step 1: Update the env-var table in `README.md`**

In `README.md`, the env-vars table currently reads:

```
| `PORT` | `5707` | HTTP port the server binds. |
| `LITEPARSE_API_KEY` | unset | If set, `/parse` and any future `/parse/*` routes require `Authorization: Bearer <key>` (timing-safe compared). If unset, auth is disabled and a warning is logged at startup. `/health` is always unauthenticated. |
| `LOG_LEVEL` | `info` | One of `debug`, `info`, `warning`, `error`, `fatal` (logtape convention — `warning` not `warn`). |
```

Add two new rows after the `LITEPARSE_API_KEY` row (alphabetical with the other `LITEPARSE_*` vars):

```
| `LITEPARSE_OCR` | `false` | If `true`, the server honors `ocrEnabled` in the request config. If unset or `false`, requests with `ocrEnabled: true` in the config are rejected with HTTP 400. Strict — only the literal string `true` enables it. |
| `LITEPARSE_MAX_SIZE_MB` | `30` | Maximum accepted upload size in megabytes. The server exits at startup if set to a non-positive integer. |
```

The full updated table is:

```
| `PORT` | `5707` | HTTP port the server binds. |
| `LITEPARSE_API_KEY` | unset | If set, `/parse` and any future `/parse/*` routes require `Authorization: Bearer <key>` (timing-safe compared). If unset, auth is disabled and a warning is logged at startup. `/health` is always unauthenticated. |
| `LITEPARSE_OCR` | `false` | If `true`, the server honors `ocrEnabled` in the request config. If unset or `false`, requests with `ocrEnabled: true` in the config are rejected with HTTP 400. Strict — only the literal string `true` enables it. |
| `LITEPARSE_MAX_SIZE_MB` | `30` | Maximum accepted upload size in megabytes. The server exits at startup if set to a non-positive integer. |
| `LOG_LEVEL` | `info` | One of `debug`, `info`, `warning`, `error`, `fatal` (logtape convention — `warning` not `warn`). |
```

- [ ] **Step 2: Update `API_SPEC.md`**

In `API_SPEC.md`, three changes:

(a) Line 13 — change the `file` field description to reference the env var:

Before:

```
  - `file` (required, `File`) — the document to parse. Max 30MB.
```

After:

```
  - `file` (required, `File`) — the document to parse. Max `LITEPARSE_MAX_SIZE_MB` MB (default 30).
```

(b) Line 19 — add a new 400 row for OCR conflict, after the existing 400 row:

Before:

```
- `400 { "detail": string }` — missing `file` field, or malformed `config` JSON.
```

After:

```
- `400 { "detail": string }` — missing `file` field, malformed `config` JSON, or `ocrEnabled: true` in the config while `LITEPARSE_OCR` is unset or `false` (detail: `"OCR is disabled; set LITEPARSE_OCR=true to enable"`).
```

(c) Line 21 — drop the hardcoded "30MB" in the 413 row and reference the env var:

Before:

```
- `413 { "detail": "File too large; max 30MB" }` — `file.size` exceeds 30MB.
```

After:

```
- `413 { "detail": "File too large; max <N>MB" }` — `file.size` exceeds `LITEPARSE_MAX_SIZE_MB` (default 30). `<N>` is the value of the env var.
```

- [ ] **Step 3: Verify the docs render correctly**

Read both files top-to-bottom to confirm the markdown tables are well-formed and the new rows are placed correctly.

- [ ] **Step 4: Commit**

```bash
git add README.md API_SPEC.md
git commit -m "docs: document LITEPARSE_OCR and LITEPARSE_MAX_SIZE_MB"
```

---

## Self-Review

**Spec coverage:**
- `/parse-stream` `__SUCCESS__` token mirroring `__ERROR__` → Task 4 ✓
- `LITEPARSE_OCR` env, strict `true`/`false` → Task 1 (`isOcrAllowed`) + Task 2 (wiring) ✓
- 400 (not silent override) when `ocrEnabled: true` + env disabled → Task 1 (`getOcrConfigError`) + Task 2 (wire) ✓
- `LITEPARSE_MAX_SIZE_MB` env, MB units, fail-fast invalid → Task 1 (`getMaxSizeBytes`) + Task 5 (docs) ✓
- Configurable max size replaces hardcoded 30MB → Task 2 (parse-request uses `getMaxSizeBytes`) ✓
- README + API_SPEC updates → Task 5 ✓
- Pure helper unit tests, no HTTP-layer tests → Task 1 only ✓

**Placeholder scan:** No "TBD"/"TODO"/"implement later" markers. Every code change has a full code block. Every test has a full test file or full test case.

**Type consistency:** `isOcrAllowed()`, `getMaxSizeBytes()`, `getOcrConfigError()` used identically in Task 1 (definitions/tests) and Task 2 (imports/wiring). `getOcrConfigError` signature takes `Record<string, unknown> | undefined` and returns `string | null` consistently. The 400 detail message is the literal string in both the helper and the docs.
