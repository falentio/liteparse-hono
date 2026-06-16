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

export async function parse(input: ParseInput): Promise<ParseResult> {
  const start = performance.now();
  const lit = new LiteParse(input.config);
  const result = await lit.parse(input.buffer, true);
  const durationMs = performance.now() - start;
  return { text: result.text, durationMs };
}
