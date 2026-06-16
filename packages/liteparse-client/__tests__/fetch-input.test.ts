import { describe, it, expect } from "vitest";
import { toFormData } from "../src/fetch-input";

describe("toFormData — ArrayBuffer", () => {
  it("builds a multipart form with the file field and default filename", async () => {
    const bytes = new TextEncoder().encode("hello world").buffer;
    const fd = toFormData(bytes, "doc.bin", "application/octet-stream");
    const file = fd.get("file");
    expect(file).toBeInstanceOf(Blob);
    const blob = file as Blob;
    expect(blob.type).toBe("application/octet-stream");
    expect(await blob.text()).toBe("hello world");
  });
});

describe("toFormData — Uint8Array (Buffer)", () => {
  it("accepts ArrayBufferView", async () => {
    const view = new Uint8Array([72, 73]); // "HI"
    const fd = toFormData(view, "greet.bin", "application/octet-stream");
    const file = fd.get("file") as Blob;
    expect(await file.text()).toBe("HI");
  });
});

describe("toFormData — File", () => {
  it("uses the File's name and type as defaults", async () => {
    const file = new File(["abc"], "note.txt", { type: "text/plain" });
    const fd = toFormData(file);
    const f = fd.get("file") as File;
    expect(f.name).toBe("note.txt");
    expect(f.type).toBe("text/plain");
    expect(await f.text()).toBe("abc");
  });
});

describe("toFormData — Blob", () => {
  it("uses opts.mimetype when Blob has no type", async () => {
    const blob = new Blob(["xyz"]);
    const fd = toFormData(blob, "x.bin", "application/octet-stream");
    const f = fd.get("file") as Blob;
    expect(f.type).toBe("application/octet-stream");
    expect(await f.text()).toBe("xyz");
  });
});

describe("toFormData — config field", () => {
  it("appends a JSON-stringified config when provided", () => {
    const fd = toFormData(
      new Uint8Array([1, 2, 3]),
      "x.bin",
      "application/octet-stream",
      { targetPages: "1" },
    );
    expect(fd.get("config")).toBe('{"targetPages":"1"}');
  });

  it("omits the config field when not provided", () => {
    const fd = toFormData(
      new Uint8Array([1, 2, 3]),
      "x.bin",
      "application/octet-stream",
    );
    expect(fd.get("config")).toBeNull();
  });
});
