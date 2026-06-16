import { describe, it, expect } from "vitest";
import { assertWinterTcGlobals } from "../src/internals/winter-tc";

describe("assertWinterTcGlobals", () => {
  it("throws when fetch is missing", () => {
    const saved = (globalThis as Record<string, unknown>).fetch;
    delete (globalThis as Record<string, unknown>).fetch;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/fetch/);
    } finally {
      (globalThis as Record<string, unknown>).fetch = saved;
    }
  });

  it("throws when ReadableStream is missing", () => {
    const saved = (globalThis as Record<string, unknown>).ReadableStream;
    delete (globalThis as Record<string, unknown>).ReadableStream;
    try {
      expect(() => assertWinterTcGlobals()).toThrow(/ReadableStream/);
    } finally {
      (globalThis as Record<string, unknown>).ReadableStream = saved;
    }
  });

  it("does not throw when all required globals are present (Node 22+)", () => {
    expect(() => assertWinterTcGlobals()).not.toThrow();
  });
});
