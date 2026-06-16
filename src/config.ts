function parseMaxSizeMb(): number {
  const raw = process.env.LITEPARSE_MAX_SIZE_MB;
  if (raw === undefined) {
    return 30;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `Invalid LITEPARSE_MAX_SIZE_MB=${JSON.stringify(raw)}: must be a positive integer in MB`,
    );
  }
  return n;
}

export function isOcrAllowed(): boolean {
  return process.env.LITEPARSE_OCR === "true";
}

export function getMaxSizeBytes(): number {
  return parseMaxSizeMb() * 1024 * 1024;
}

export function getOcrConfigError(
  config: Record<string, unknown> | undefined,
): string | null {
  if (isOcrAllowed()) return null;
  if (config && config.ocrEnabled === true) {
    return "OCR is disabled; set LITEPARSE_OCR=true to enable";
  }
  return null;
}
