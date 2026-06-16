import type { LiteParseConfig, ParseInput } from "./types.js";

export function toFormData(
  input: ParseInput,
  filename?: string,
  mimetype?: string,
  config?: Partial<LiteParseConfig>,
): FormData {
  const fd = new FormData();

  if (input instanceof File) {
    fd.append("file", input, input.name);
  } else if (input instanceof Blob) {
    const name = filename ?? "blob";
    if (mimetype) {
      fd.append("file", new Blob([input], { type: mimetype }), name);
    } else {
      fd.append("file", input, name);
    }
  } else {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    const name = filename ?? "buffer.bin";
    const blob = new Blob([bytes as BlobPart], mimetype ? { type: mimetype } : undefined);
    fd.append("file", blob, name);
  }

  if (config !== undefined) {
    fd.append("config", JSON.stringify(config));
  }

  return fd;
}
