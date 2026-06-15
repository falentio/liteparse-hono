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
