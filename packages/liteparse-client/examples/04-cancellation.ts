/**
 * Example 04: Cancellation
 *
 * Starts a parse, then aborts it after 50ms. Expects an aborted("user")
 * error. If the parse completes first, you'll see the success result.
 */
import { LiteparseClient } from "../src/index.js";

const client = new LiteparseClient();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 50);

const result = await client.parse(new TextEncoder().encode("long input ".repeat(10000)), {
  filename: "big.md",
  mimetype: "text/markdown",
  signal: controller.signal,
});
clearTimeout(timer);

if (result.ok) {
  console.log("OK:", result.value.slice(0, 200));
} else if (result.error.kind === "aborted") {
  console.log("Aborted (reason:", result.error.reason + ")");
} else {
  const detail = "message" in result.error ? result.error.message : "(no detail)";
  console.error("ERR:", result.error.kind, detail);
}
