import { describe, it, expect } from "vitest";
import { multipartRequestFromInput } from "../src/test-utils";

describe("multipartRequestFromInput — endpoint path", () => {
  it("uses /parse path when endpoint: 'parse'", async () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { filename: "x.bin", mimetype: "application/octet-stream" },
      "https://api.example.com",
      "parse",
    );
    expect(new URL(req.url).pathname).toBe("/parse");
  });

  it("uses /parse path by default (no endpoint arg)", async () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { filename: "x.bin", mimetype: "application/octet-stream" },
      "https://api.example.com",
    );
    expect(new URL(req.url).pathname).toBe("/parse");
  });

  it("uses /parse-stream path when endpoint: 'parse-stream'", async () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { filename: "x.bin", mimetype: "application/octet-stream" },
      "https://api.example.com",
      "parse-stream",
    );
    expect(new URL(req.url).pathname).toBe("/parse-stream");
  });
});

describe("multipartRequestFromInput — request shape", () => {
  it("uses POST method", () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { filename: "x.bin", mimetype: "application/octet-stream" },
      "https://api.example.com",
      "parse",
    );
    expect(req.method).toBe("POST");
  });
});

describe("multipartRequestFromInput — filename", () => {
  it("uses File.name when input is a File", async () => {
    const file = new File(["x"], "doc.pdf");
    const req = multipartRequestFromInput(
      file,
      {},
      "https://api.example.com",
      "parse",
    );
    const fd = await req.formData();
    const f = fd.get("file") as File;
    expect(f.name).toBe("doc.pdf");
  });

  it("uses File.type when input is a File", async () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const req = multipartRequestFromInput(
      file,
      {},
      "https://api.example.com",
      "parse",
    );
    const fd = await req.formData();
    const f = fd.get("file") as File;
    expect(f.type).toBe("application/pdf");
  });

  it("uses Blob.type for Blob input when no mimetype is provided", async () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    const req = multipartRequestFromInput(
      blob,
      {},
      "https://api.example.com",
      "parse",
    );
    const fd = await req.formData();
    const f = fd.get("file") as Blob;
    expect(f.type).toBe("text/plain");
  });

  it("falls back to 'buffer.bin' when neither File.name nor opts.filename are set", async () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { mimetype: "application/octet-stream" },
      "https://api.example.com",
      "parse",
    );
    const fd = await req.formData();
    const f = fd.get("file") as File;
    expect(f.name).toBe("buffer.bin");
  });
});

describe("multipartRequestFromInput — config", () => {
  it("includes config field as JSON string when provided", async () => {
    const req = multipartRequestFromInput(
      new Uint8Array([1, 2, 3]),
      { filename: "x.bin", mimetype: "application/octet-stream", config: { targetPages: "1" } },
      "https://api.example.com",
      "parse",
    );
    const fd = await req.formData();
    expect(fd.get("config")).toBe('{"targetPages":"1"}');
  });
});
