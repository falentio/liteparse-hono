import { describe, it, expect, vi } from "vitest";
import { LiteparseClient } from "../src/client";
import { mockFetch, stringToReadableStream, multipartRequestFromInput } from "../src/test-utils";

vi.mock("../src/version.js", () => ({
  VERSION: "0.1.0",
}));

const EXPECTED_VERSION = "0.1.0";

function makeClient(overrides: Partial<{ endpoint: "parse" | "parse-stream"; apiKey: string; baseUrl: string; fetch: typeof fetch; maxRetries: number; retryDelayMs: number; timeoutMs: number }> = {}) {
  return new LiteparseClient({
    baseUrl: overrides.baseUrl ?? "https://api.example.com",
    endpoint: overrides.endpoint ?? "parse",
    apiKey: overrides.apiKey,
    fetch: overrides.fetch,
    maxRetries: overrides.maxRetries,
    retryDelayMs: overrides.retryDelayMs,
    timeoutMs: overrides.timeoutMs,
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

  it("sends User-Agent header matching @falentio/liteparse-client/<semver> on every request", async () => {
    let captured: Request | null = null;
    const fetchMock = mockFetch(async (req) => {
      captured = req;
      return new Response("ok", { status: 200 });
    });
    const client = makeClient({ apiKey: "k", fetch: fetchMock });
    const result = await client.parse(new Uint8Array([1]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(true);
    expect(captured).not.toBeNull();
    const ua = captured!.headers.get("User-Agent");
    expect(ua).toMatch(/^@falentio\/liteparse-client\/\d+\.\d+\.\d+$/);
    expect(ua).toBe(`@falentio/liteparse-client/${EXPECTED_VERSION}`);
  });

  it("sends User-Agent even without apiKey", async () => {
    let captured: Request | null = null;
    const fetchMock = mockFetch(async (req) => {
      captured = req;
      return new Response("ok", { status: 200 });
    });
    const client = makeClient({ fetch: fetchMock });
    await client.parse(new Uint8Array([1]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("User-Agent")).toMatch(
      /^@falentio\/liteparse-client\/\d+\.\d+\.\d+$/,
    );
    expect(captured!.headers.get("Authorization")).toBeNull();
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
      signal: ctrl.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("aborted");
  });

  it("returns Result.err kind: invalid_input when filename is missing for ArrayBuffer", async () => {
    const client = makeClient();
    const result = await client.parse(new Uint8Array([0]), {
      mimetype: "application/octet-stream",
    });
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
    const client = makeClient({ endpoint: "parse-stream", fetch: fetchMock });
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
    const client = makeClient({ endpoint: "parse-stream", fetch: fetchMock });
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

describe("LiteparseClient — retry/timeout", () => {
  it("retries on 503 and returns success on the second attempt", async () => {
    let calls = 0;
    const fetchMock = mockFetch(async () => {
      calls++;
      if (calls === 1) return new Response("server error", { status: 503 });
      return new Response("ok", { status: 200 });
    });
    const client = makeClient({ fetch: fetchMock, retryDelayMs: 1 });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does not retry on 4xx errors", async () => {
    let calls = 0;
    const fetchMock = mockFetch(async () => {
      calls++;
      return new Response(JSON.stringify({ detail: "bad input" }), { status: 400 });
    });
    const client = makeClient({ fetch: fetchMock, retryDelayMs: 1 });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "http") {
      expect(result.error.status).toBe(400);
    } else {
      throw new Error("expected http error");
    }
    expect(calls).toBe(1);
  });

  it("stops after maxRetries attempts and returns the last error", async () => {
    let calls = 0;
    const fetchMock = mockFetch(async () => {
      calls++;
      return new Response("server error", { status: 503 });
    });
    const client = makeClient({ fetch: fetchMock, maxRetries: 2, retryDelayMs: 1 });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it("short-circuits the retry loop when user signal aborts", async () => {
    let calls = 0;
    const fetchMock = mockFetch(async () => {
      calls++;
      return new Response("server error", { status: 503 });
    });
    const client = makeClient({ fetch: fetchMock, maxRetries: 3, retryDelayMs: 50 });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10);
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
      signal: ctrl.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "aborted") {
      expect(result.error.reason).toBe("user");
    } else {
      throw new Error("expected aborted user");
    }
  });

  it("returns aborted('timeout') when the client timeout fires", async () => {
    const fetchMock = mockFetch(async (req) => {
      await new Promise<void>((resolve) => {
        req.signal.addEventListener("abort", () => resolve());
      });
      throw new DOMException("aborted", "AbortError");
    });
    const client = makeClient({ fetch: fetchMock, timeoutMs: 50, retryDelayMs: 1 });
    const result = await client.parse(new Uint8Array([0]), {
      filename: "x.bin",
      mimetype: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "aborted") {
      expect(result.error.reason).toBe("timeout");
    } else {
      throw new Error("expected aborted timeout");
    }
  });
});
