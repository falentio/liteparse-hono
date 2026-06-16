import { describe, it, expectTypeOf } from "vitest";
import { ok, err, type Result } from "../src/result";

describe("Result", () => {
  it("ok() constructs an ok result", () => {
    const r = ok("hello");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe("hello");
    } else {
      throw new Error("expected ok");
    }
  });

  it("err() constructs an err result", () => {
    const r = err({ kind: "network", cause: new Error("x") } as const);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("network");
    } else {
      throw new Error("expected err");
    }
  });

  it("narrows correctly via discriminator", () => {
    const r: Result<string, { kind: "x" }> = ok("v");
    if (r.ok) {
      expectTypeOf(r.value).toEqualTypeOf<string>();
    } else {
      expectTypeOf(r.error).toEqualTypeOf<{ kind: "x" }>();
    }
  });
});
