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
