/**
 * Example 01: Basic non-streaming parse
 *
 * Posts a tiny buffer to the /parse endpoint and prints the markdown result
 * (or the error). Uses the default base URL (https://api.liteparse.dev).
 */
import { LiteparseClient } from "../src/index.js";

const client = new LiteparseClient();

const result = await client.parse(new TextEncoder().encode("# Hello\n\nWorld"), {
  filename: "hello.md",
  mimetype: "text/markdown",
});

if (result.ok) {
  console.log("OK:", result.value.slice(0, 200));
} else {
  const detail = "message" in result.error ? result.error.message : "(no detail)";
  console.error("ERR:", result.error.kind, detail);
}
