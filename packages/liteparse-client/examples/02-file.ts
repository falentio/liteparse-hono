/**
 * Example 02: File upload
 *
 * Reads a PDF from disk and parses it. Replace 'sample.pdf' with a real file
 * (or pass a path as the first CLI arg).
 */
import { readFile } from "node:fs/promises";
import { LiteparseClient } from "../src/index.js";

const path = process.argv[2] ?? "sample.pdf";
const bytes = await readFile(path);

const client = new LiteparseClient();
const result = await client.parse(bytes, {
  filename: path,
  mimetype: "application/pdf",
});

if (result.ok) {
  console.log("OK:", result.value.slice(0, 200));
} else {
  const detail = "message" in result.error ? result.error.message : "(no detail)";
  console.error("ERR:", result.error.kind, detail);
}
