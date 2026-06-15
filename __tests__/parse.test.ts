import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "../src/parse";

const PE_DEAL_PDF = "data/pe_deal_examples.pdf";
const RECEIPT_PNG = "data/receipt.png";
const OFFICE_DOCX = "data/sample3.docx.doc";

const ALPHAFLEX = "AlphaFlex Packaging Group";
const VERIDIAN = "Veridian Health Technologies";
const RECEIPT_HEADER = "Article Count Amount Tax";
const DOCX_SNIPPET_1 =
  "This document was created using accessibility techniques for headings";
const DOCX_SNIPPET_2 =
  "Simple tables have a uniform number of columns and rows, without any merged cells:";

async function loadAsInput(filePath: string, mimetype: string) {
  const buffer = await readFile(filePath);
  return {
    buffer,
    filename: path.basename(filePath),
    mimetype,
  };
}

describe("parse() — PDF", () => {
  it("extracts text from all pages without config", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse(input);
    expect(result.text).toContain(ALPHAFLEX);
    expect(result.text).toContain(VERIDIAN);
  });

  it("respects targetPages config to limit extraction", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse({ ...input, config: { targetPages: "1" } });
    expect(result.text).toContain(ALPHAFLEX);
    expect(result.text).not.toContain(VERIDIAN);
  });
});

describe("parse() — PNG", () => {
  it("extracts text from a PNG without config", async () => {
    const input = await loadAsInput(RECEIPT_PNG, "image/png");
    const result = await parse(input);
    expect(result.text).toContain(RECEIPT_HEADER);
  });

  it("respects dpi config", async () => {
    const input = await loadAsInput(RECEIPT_PNG, "image/png");
    const result = await parse({ ...input, config: { dpi: 200 } });
    expect(result.text).toContain(RECEIPT_HEADER);
  });
});

describe("parse() — DOCX", () => {
  it("extracts text from all pages without config", async () => {
    const input = await loadAsInput(
      OFFICE_DOCX,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse(input);
    expect(result.text).toContain(DOCX_SNIPPET_1);
    expect(result.text).toContain(DOCX_SNIPPET_2);
  });

  it("respects targetPages config to limit extraction", async () => {
    const input = await loadAsInput(
      OFFICE_DOCX,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse({ ...input, config: { targetPages: "1" } });
    expect(result.text).toContain(DOCX_SNIPPET_1);
  });
});

describe("parse() — return shape", () => {
  it("returns { text, durationMs }", async () => {
    const input = await loadAsInput(PE_DEAL_PDF, "application/pdf");
    const result = await parse(input);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
