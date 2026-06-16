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
