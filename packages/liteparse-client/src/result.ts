/**
 * A discriminated union representing either a success (`{ ok: true, value }`)
 * or a failure (`{ ok: false, error }`). The `parse()` method never rejects;
 * use the `ok` discriminator to narrow.
 *
 * @typeParam T - the success value type
 * @typeParam E - the error type
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Wrap a success value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wrap an error value. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
