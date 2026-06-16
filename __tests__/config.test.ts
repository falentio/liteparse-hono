import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOcrAllowed, getMaxSizeBytes, getOcrConfigError } from "../src/config";

describe("isOcrAllowed", () => {
  afterEach(() => {
    delete process.env.LITEPARSE_OCR;
  });

  it("returns false when LITEPARSE_OCR is unset", () => {
    delete process.env.LITEPARSE_OCR;
    expect(isOcrAllowed()).toBe(false);
  });

  it('returns false when LITEPARSE_OCR="false"', () => {
    process.env.LITEPARSE_OCR = "false";
    expect(isOcrAllowed()).toBe(false);
  });

  it('returns true when LITEPARSE_OCR="true"', () => {
    process.env.LITEPARSE_OCR = "true";
    expect(isOcrAllowed()).toBe(true);
  });

  it('returns false when LITEPARSE_OCR="TRUE" (strict case match)', () => {
    process.env.LITEPARSE_OCR = "TRUE";
    expect(isOcrAllowed()).toBe(false);
  });

  it("returns false for any other value (strict truthy/falsy)", () => {
    process.env.LITEPARSE_OCR = "1";
    expect(isOcrAllowed()).toBe(false);
    process.env.LITEPARSE_OCR = "yes";
    expect(isOcrAllowed()).toBe(false);
    process.env.LITEPARSE_OCR = "";
    expect(isOcrAllowed()).toBe(false);
  });
});

describe("getOcrConfigError", () => {
  afterEach(() => {
    delete process.env.LITEPARSE_OCR;
  });

  it("returns null when OCR is allowed and user requests true", () => {
    process.env.LITEPARSE_OCR = "true";
    expect(getOcrConfigError({ ocrEnabled: true })).toBeNull();
  });

  it("returns null when OCR is disabled and user omits ocrEnabled", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ targetPages: "1" })).toBeNull();
  });

  it("returns null when OCR is disabled and user passes ocrEnabled=false", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ ocrEnabled: false })).toBeNull();
  });

  it("returns the disabled message when OCR is disabled and user passes ocrEnabled=true", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError({ ocrEnabled: true })).toBe(
      "OCR is disabled; set LITEPARSE_OCR=true to enable",
    );
  });

  it("returns the disabled message when LITEPARSE_OCR=false and user passes ocrEnabled=true", () => {
    process.env.LITEPARSE_OCR = "false";
    expect(getOcrConfigError({ ocrEnabled: true })).toBe(
      "OCR is disabled; set LITEPARSE_OCR=true to enable",
    );
  });

  it("returns null when config is undefined", () => {
    delete process.env.LITEPARSE_OCR;
    expect(getOcrConfigError(undefined)).toBeNull();
  });
});

describe("getMaxSizeBytes", () => {
  const original = process.env.LITEPARSE_MAX_SIZE_MB;

  beforeEach(() => {
    delete process.env.LITEPARSE_MAX_SIZE_MB;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LITEPARSE_MAX_SIZE_MB;
    } else {
      process.env.LITEPARSE_MAX_SIZE_MB = original;
    }
  });

  it("returns 30 * 1024 * 1024 when LITEPARSE_MAX_SIZE_MB is unset", () => {
    expect(getMaxSizeBytes()).toBe(30 * 1024 * 1024);
  });

  it("returns env value * 1024 * 1024 when LITEPARSE_MAX_SIZE_MB is set", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "50";
    expect(getMaxSizeBytes()).toBe(50 * 1024 * 1024);
  });

  it("accepts small positive values", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "1";
    expect(getMaxSizeBytes()).toBe(1024 * 1024);
  });

  it("throws on non-numeric value", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "abc";
    expect(() => getMaxSizeBytes()).toThrow(
      /Invalid LITEPARSE_MAX_SIZE_MB="abc"/,
    );
  });

  it("throws on zero", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "0";
    expect(() => getMaxSizeBytes()).toThrow(/Invalid LITEPARSE_MAX_SIZE_MB="0"/);
  });

  it("throws on negative value", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "-1";
    expect(() => getMaxSizeBytes()).toThrow(
      /Invalid LITEPARSE_MAX_SIZE_MB="-1"/,
    );
  });

  it("throws on non-integer value", () => {
    process.env.LITEPARSE_MAX_SIZE_MB = "1.5";
    expect(() => getMaxSizeBytes()).toThrow(
      /Invalid LITEPARSE_MAX_SIZE_MB="1.5"/,
    );
  });
});
