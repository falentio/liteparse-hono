#!/usr/bin/env node
// stress.mjs — concurrent stress test for liteparse-hono /parse-stream
//
// Spawns <concurrency> parallel workers; each worker fires 3 sequential
// PDF POST /parse-stream requests. Total requests = concurrency × 3.
//
// Usage:
//   scripts/stress.mjs <concurrency> <baseurl> [apikey]
//
// Env:
//   LITEPARSE_API_KEY  Bearer token (overridden by 3rd arg)
//   PDF_PATH           Override the PDF fixture (default:
//                      data/pe_deal_examples.pdf relative to repo root)
//   NO_COLOR           Set to any value to disable color output

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { performance } from "node:perf_hooks";

const PER_WORKER = 3;
const TIMEOUT_MS = 120_000;

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const C = USE_COLOR
  ? {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      gray: "\x1b[90m",
    }
  : Object.fromEntries(
      "reset bold dim red green yellow cyan gray".split(" ").map((k) => [k, ""]),
    );

const paint = (color, text) => `${C[color]}${text}${C.reset}`;
const OK = paint("green", "✓");
const BAD = paint("red", "✗");
const WARN = paint("yellow", "⚠");
const DOT_OK = paint("green", "●");
const DOT_FAIL = paint("red", "●");
const RULE = paint("gray", "─".repeat(60));
const RULE_HEAVY = paint("gray", "═".repeat(60));

const latencyColor = (s) =>
  s < 0.5 ? "green" : s < 2 ? "yellow" : "red";
const latencyCell = (s) => paint(latencyColor(s), s.toFixed(3));
const rateColor = (pct) =>
  pct >= 100 ? "green" : pct >= 95 ? "yellow" : "red";

const USAGE = `Usage: stress.mjs <concurrency> <baseurl> [apikey]

Arguments:
  concurrency  Number of parallel workers (positive integer)
  baseurl      Server base URL (http:// or https://)
  apikey       Authorization Bearer token (default: \$LITEPARSE_API_KEY)`;

const args = process.argv.slice(2);
if (args[0] === "-h" || args[0] === "--help" || args[0] === "help") {
  console.log(USAGE);
  process.exit(0);
}
if (args.length < 2) {
  console.error(USAGE);
  process.exit(1);
}

const [CONCURRENCY_RAW, BASEURL, APIKEY_ARG] = args;
const CONCURRENCY = Number.parseInt(CONCURRENCY_RAW, 10);
const APIKEY = APIKEY_ARG ?? process.env.LITEPARSE_API_KEY ?? "";
const ENDPOINT = `${BASEURL.replace(/\/+$/, "")}/parse-stream`;
let failed = false;
const step = (n, total, label) => {
  console.log(`\n${paint("cyan", `[${n}/${total}]`)} ${paint("bold", label)}`);
};
const die = (msg) => {
  console.error(`\n${BAD} ${msg}`);
  process.exit(1);
};

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1) {
  die(`concurrency must be a positive integer (got '${CONCURRENCY_RAW}')`);
}
if (!APIKEY) {
  die("API key required (pass as 3rd arg or set LITEPARSE_API_KEY)");
}
if (!/^https?:\/\//.test(BASEURL)) {
  die("baseurl must start with http:// or https://");
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const PDF_PATH =
  process.env.PDF_PATH ?? join(REPO_ROOT, "data", "pe_deal_examples.pdf");

let pdfBuffer;
try {
  pdfBuffer = await readFile(PDF_PATH);
} catch (err) {
  die(`PDF not found at ${PDF_PATH} (${err.message})`);
}

const TOTAL_REQS = CONCURRENCY * PER_WORKER;
const SCHEME = BASEURL.startsWith("https") ? "https" : "http";

console.log(RULE_HEAVY);
console.log(
  `${paint("bold", "Stress Test")}  ${paint("dim", "→")}  ${BASEURL}`,
);
console.log(RULE);
console.log(
  `  ${paint("dim", "Scheme:")}      ${SCHEME}  ${paint("dim", "Concurrency:")} ${CONCURRENCY} ${paint("dim", "workers")}  ${paint("dim", "Per worker:")} ${PER_WORKER} ${paint("dim", "PDFs")}  ${paint("dim", "Total:")} ${TOTAL_REQS} ${paint("dim", "requests")}`,
);
console.log(RULE_HEAVY);

step(1, 3, "Validating inputs");
console.log(`  ${OK} concurrency  = ${paint("cyan", CONCURRENCY)}`);
console.log(`  ${OK} baseurl      = ${paint("cyan", BASEURL)}`);
console.log(`  ${OK} endpoint     = ${paint("cyan", ENDPOINT)}`);
console.log(
  `  ${OK} api key      = ${paint("dim", "•".repeat(Math.min(APIKEY.length, 16)))} ${paint("dim", `(${APIKEY.length} chars)`)}`,
);
console.log(
  `  ${OK} PDF fixture  = ${paint("cyan", basename(PDF_PATH))} ${paint("dim", `(${pdfBuffer.length.toLocaleString()} bytes)`)}`,
);

step(2, 3, "Running stress test");
console.log(
  `  ${paint("dim", `Firing ${TOTAL_REQS} requests across ${CONCURRENCY} parallel workers…`)}`,
);

async function fireRequest() {
  const start = performance.now();
  let status = "000";
  let body = "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append(
      "file",
      new File([pdfBuffer], basename(PDF_PATH), { type: "application/pdf" }),
    );
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${APIKEY}` },
      body: form,
      signal: controller.signal,
    });
    status = String(res.status);
    body = await res.text();
  } catch (err) {
    body = `error: ${err.message}`;
  } finally {
    clearTimeout(timer);
  }
  const duration = (performance.now() - start) / 1000;
  return { status, duration, body };
}

async function worker() {
  const results = [];
  for (let i = 0; i < PER_WORKER; i++) {
    const r = await fireRequest();
    process.stdout.write(r.status === "200" ? DOT_OK : DOT_FAIL);
    results.push(r);
  }
  return results;
}

const wallStart = performance.now();
const allResults = (
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
).flat();
const wallDur = (performance.now() - wallStart) / 1000;
console.log();

step(3, 3, "Aggregating results");
let success = 0;
let fail = 0;
const durations = [];
for (const r of allResults) {
  if (r.status === "200") success++;
  else fail++;
  durations.push(r.duration);
}

durations.sort((a, b) => a - b);
const count = durations.length;
const pick = (p) => {
  if (count === 0) return 0;
  const idx = Math.min(count - 1, Math.round(count * p) - 1);
  return idx >= 0 ? durations[idx] : 0;
};
const min = count ? durations[0] : 0;
const max = count ? durations[count - 1] : 0;
const mean = count ? durations.reduce((s, d) => s + d, 0) / count : 0;
const p50 = pick(0.5);
const p95 = pick(0.95);
const p99 = pick(0.99);
const rps = wallDur > 0 ? count / wallDur : 0;
const successPct = count > 0 ? (success / count) * 100 : 0;

console.log(
  `  ${success === count ? OK : WARN} ${success}/${count} ${paint("dim", "succeeded")} (${paint(rateColor(successPct), successPct.toFixed(1) + "%")})`,
);
if (fail > 0) {
  console.log(
    `  ${BAD} ${fail}/${count} ${paint("dim", "failed")} (${paint("red", fail.toString())})`,
  );
}

console.log();
console.log(RULE_HEAVY);
console.log(`  ${paint("bold", "Results")}`);
console.log(RULE);
console.log(
  `  ${paint("dim", "Wall time")}     ${paint("cyan", wallDur.toFixed(3) + " s")}`,
);
console.log(
  `  ${paint("dim", "Total reqs")}    ${paint("cyan", count.toString())}`,
);
console.log(
  `  ${paint("dim", "Success")}       ${paint(rateColor(successPct), success + " (" + successPct.toFixed(1) + "%)")}`,
);
console.log(
  `  ${paint("dim", "Failure")}       ${fail > 0 ? paint("red", fail.toString()) : paint("dim", "0")}`,
);
console.log(
  `  ${paint("dim", "Throughput")}    ${paint("cyan", rps.toFixed(2) + " req/s")}`,
);
console.log(RULE);
console.log(`  ${paint("bold", "Latency (s)")}`);
console.log(
  `    ${paint("dim", "min")}    ${latencyCell(min)}    ${paint("dim", "p50")}    ${latencyCell(p50)}`,
);
console.log(
  `    ${paint("dim", "mean")}   ${latencyCell(mean)}    ${paint("dim", "p95")}    ${latencyCell(p95)}`,
);
console.log(
  `    ${paint("dim", "max")}    ${latencyCell(max)}    ${paint("dim", "p99")}    ${latencyCell(p99)}`,
);
console.log(RULE_HEAVY);

if (fail > 0) {
  failed = true;
  console.log();
  console.log(
    `  ${paint("bold", paint("red", "Non-200 responses"))} ${paint("dim", "(up to 5):")}`,
  );
  let shown = 0;
  for (let i = 0; i < allResults.length && shown < 5; i++) {
    const r = allResults[i];
    if (r.status === "200") continue;
    const text =
      r.body.length > 200 ? `${r.body.slice(0, 200)}…` : r.body;
    console.log(
      `    ${paint("red", `[${r.status}]`)} request ${i + 1}: ${text}`,
    );
    shown++;
  }
}

if (failed) process.exit(1);
