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

  it("aborted has a required reason", () => {
    const e = aborted("user");
    expect(e.kind).toBe("aborted");
    if (e.kind === "aborted") {
      expect(e.reason).toBe("user");
    }
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
    expectTypeOf<LiteparseError["kind"]>().toEqualTypeOf<
      "invalid_input" | "network" | "aborted" | "http" | "stream_token" | "decode"
    >();
  });
});
