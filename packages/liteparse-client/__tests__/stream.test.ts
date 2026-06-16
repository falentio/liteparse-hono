import { describe, it, expect } from "vitest";
import { readStreamBody } from "../src/stream";
import { stringToReadableStream, erroringReadableStream } from "../src/test-utils";

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

describe("readStreamBody — edge cases", () => {
  it("returns err(kind: decode) on mid-stream Error after partial success bytes", async () => {
    const body = erroringReadableStream(
      new Error("connection lost"),
      ["__SUCC", "ESS__:par"],
    );
    const r = await readStreamBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "decode") {
      expect(r.error.message).toBe("connection lost");
    } else {
      throw new Error("expected decode error");
    }
  });

  it("returns err(kind: decode) on mid-stream DOMException", async () => {
    const body = erroringReadableStream(
      new DOMException("aborted", "AbortError"),
      ["__SUCCESS__:par"],
    );
    const r = await readStreamBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "decode") {
      expect(r.error.message).toBe("aborted");
    } else {
      throw new Error("expected decode error");
    }
  });

  it("returns ok(\"\") for an empty payload after __SUCCESS__:", async () => {
    const body = stringToReadableStream("__SUCCESS__:");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("");
  });

  it("returns err(kind: stream_token, message: \"\") for an empty message after __ERROR__:", async () => {
    const body = stringToReadableStream("__ERROR__:");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "stream_token") {
      expect(r.error.message).toBe("");
    } else {
      throw new Error("expected stream_token error");
    }
  });

  it("returns the unprefixed text when __SUCCESS__: appears mid-string (defensive)", async () => {
    const body = stringToReadableStream("text __SUCCESS__:more");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("text __SUCCESS__:more");
  });

  it("parses an __ERROR__: token split across chunks", async () => {
    const body = stringToReadableStream("__ERR", "OR__:bad");
    const r = await readStreamBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "stream_token") {
      expect(r.error.message).toBe("bad");
    } else {
      throw new Error("expected stream_token error");
    }
  });
});
