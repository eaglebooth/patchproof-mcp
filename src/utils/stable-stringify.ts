/**
 * Stable JSON stringifier. Object keys are sorted recursively; this
 * is used to compute deterministic OSV cache keys so that mock
 * responses are byte-stable across runs.
 *
 * Not a general-purpose stable stringifier — does not handle
 * cycles, `undefined`, `BigInt`, functions, symbols, or class
 * instances. Inputs must be JSON-safe plain data.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isPlainObject(v: unknown): v is { [k: string]: Json } {
  if (v === null || typeof v !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v): Json => normalize(v));
  }
  if (isPlainObject(value)) {
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = normalize(value[k]);
    }
    return out;
  }
  throw new TypeError(`stableStringify: unsupported value of type ${typeof value}`);
}
