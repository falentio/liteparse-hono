import { LiteParse, type LiteParseConfig } from "@llamaindex/liteparse";

export type ParseInput = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  config?: Partial<LiteParseConfig>;
};

export type ParseResult = {
  text: string;
  durationMs: number;
};

export function resolveConfig(input: Partial<LiteParseConfig> | undefined): Partial<LiteParseConfig> {
  if (!input) {
    return {
      ocrEnabled: false,
    }
  }
  return {
    ...input,
    ocrEnabled: false
  }
}

export async function parse(input: ParseInput): Promise<ParseResult> {
  const config = resolveConfig(input.config);
  const start = performance.now();
  const lit = new LiteParse(config);
  const result = await lit.parse(input.buffer, true);
  const durationMs = performance.now() - start;
  return { text: result.text, durationMs };
}
