/**
 * Example 03: Streaming parse
 *
 * Uses the /parse-stream endpoint, which returns a token-framed stream:
 *   __SUCCESS__:<markdown>   (success)
 *   __ERROR__:<message>      (server-side parse error)
 */
import { LiteparseClient } from "../src/index.js";

const client = new LiteparseClient({ endpoint: "parse-stream" });

const result = await client.parse(new TextEncoder().encode("# Streaming\n\nHello"), {
  filename: "hello.md",
  mimetype: "text/markdown",
});

if (result.ok) {
  console.log("OK:", result.value);
} else {
  const detail = "message" in result.error ? result.error.message : "(no detail)";
  console.error("ERR:", result.error.kind, detail);
}
