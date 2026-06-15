import * as v from "valibot";

// We validate the form field as a JSON string, then parse it to a plain object.
// The shape of the parsed object is left to LiteParse to validate at parse time
// (mirrors the original server's behavior of passing the config through).
const JsonObject = v.pipe(
  v.string(),
  v.parseJson(),
  v.record(v.string(), v.unknown()),
);

export const parseFormSchema = v.object({
  file: v.file(),
  config: v.optional(JsonObject),
});

export type ParseForm = v.InferOutput<typeof parseFormSchema>;
