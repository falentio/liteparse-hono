const REQUIRED = [
  "fetch",
  "ReadableStream",
  "Blob",
  "File",
  "FormData",
  "Request",
  "Response",
  "Headers",
  "TextEncoder",
  "TextDecoder",
  "URL",
  "URLSearchParams",
] as const;

export function assertWinterTcGlobals(): void {
  const missing: string[] = [];
  for (const name of REQUIRED) {
    if (typeof (globalThis as Record<string, unknown>)[name] === "undefined") {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required WinterTC globals on this runtime: ${missing.join(", ")}. ` +
        `Target Node 22+ (which ships these natively) or import a polyfill before using @falentio/liteparse-client.`,
    );
  }
}
