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

`pnpm build` produces `dist/index.js` (a thin ESM wrapper that imports the bundled `node_modules/` from the same image). `pnpm start` runs that file with Node.

## Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `5707` | HTTP port the server binds. |
| `LITEPARSE_API_KEY` | unset | If set, `/parse` and any future `/parse/*` routes require `Authorization: Bearer <key>` (timing-safe compared). If unset, auth is disabled and a warning is logged at startup. `/health` is always unauthenticated. |
| `LITEPARSE_OCR` | `false` | If `true`, the server honors `ocrEnabled` in the request config. If unset or `false`, requests with `ocrEnabled: true` in the config are rejected with HTTP 400. Strict — only the literal string `true` enables it. |
| `LITEPARSE_MAX_SIZE_MB` | `30` | Maximum accepted upload size in megabytes. The server exits at startup if set to a non-positive integer. |
| `LOG_LEVEL` | `info` | One of `debug`, `info`, `warning`, `error`, `fatal` (logtape convention — `warning` not `warn`). |

## Test

```bash
pnpm test         # run once
pnpm test:watch   # watch mode
```

Tests cover the `parse()` business logic only. The HTTP layer is exercised manually (see `API_SPEC.md`) and via the Dockerfile image.

## API

See [`API_SPEC.md`](./API_SPEC.md).
