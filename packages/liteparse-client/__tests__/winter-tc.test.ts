import { describe, it, expect } from "vitest";
import { assertWinterTcGlobals } from "../src/internals/winter-tc";

interface GlobalShape {
  fetch: unknown;
  ReadableStream: unknown;
  Blob: unknown;
  File: unknown;
  FormData: unknown;
  Request: unknown;
  Response: unknown;
  Headers: unknown;
  TextEncoder: unknown;
  TextDecoder: unknown;
  URL: unknown;
  URLSearchParams: unknown;
}

describe("assertWinterTcGlobals", () => {
  it("throws when fetch is missing", () => {
    const saved = (globalThis as GlobalShape).fetch;
    delete (globalThis as GlobalShape).fetch;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/fetch/);
    } finally {
      (globalThis as GlobalShape).fetch = saved;
    }
  });

  it("throws when ReadableStream is missing", () => {
    const saved = (globalThis as GlobalShape).ReadableStream;
    delete (globalThis as GlobalShape).ReadableStream;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/ReadableStream/);
    } finally {
      (globalThis as GlobalShape).ReadableStream = saved;
    }
  });

  it("does not throw when all required globals are present (Node 22+)", () => {
    expect(() => assertWinterTcGlobals()).not.toThrow();
  });
});
