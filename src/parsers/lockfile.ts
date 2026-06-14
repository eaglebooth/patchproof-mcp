/**
 * Pure parser for `package-lock.json` (npm lockfile v2 / v3).
 *
 * The parser does not touch the filesystem. It accepts the raw
 * lockfile text, returns a deterministic, read-only array of
 * `ParsedLockfileEntry` records. No external dependencies.
 *
 * Format reference: the npm lockfile has a top-level `packages`
 * map keyed by install path. The root path `""` is the project
 * itself and is skipped. A key like `node_modules/foo` is a
 * direct dependency; a key like
 * `node_modules/foo/node_modules/bar` is a transitive dependency
 * pulled in by `foo`. v3 lockfiles have only `packages`; v2 also
 * includes a `dependencies` map for back-compat, but we prefer
 * `packages` because it carries the install path, dev flag, and
 * license metadata.
 */

export interface ParsedLockfileEntry {
  readonly name: string;
  readonly version: string;
  readonly isDev: boolean;
  readonly isTransitive: boolean;
  readonly licenses: ReadonlyArray<string>;
  readonly integrity?: string;
}

export type LockfileParseStatus = 'ok' | 'malformed';

export interface ParsedLockfile {
  readonly status: LockfileParseStatus;
  readonly entries: ReadonlyArray<ParsedLockfileEntry>;
}

interface RawLockfilePackage {
  readonly name?: string;
  readonly version?: string;
  readonly dev?: boolean;
  readonly optional?: boolean;
  readonly license?: string | ReadonlyArray<string>;
  readonly integrity?: string;
}

interface RawLockfile {
  readonly lockfileVersion?: number;
  readonly packages?: Readonly<Record<string, RawLockfilePackage>>;
}

const TRANSITIVE_PREFIX = 'node_modules/';

/**
 * Parse the JSON text of an npm `package-lock.json` and return a
 * sorted, read-only list of dependency entries.
 *
 * The root package (key `""`) is skipped because it represents
 * the project itself, not a third-party dependency.
 */
export function parseNpmLockfile(jsonText: string): ReadonlyArray<ParsedLockfileEntry> {
  return parseNpmLockfileDetailed(jsonText).entries;
}

export function parseNpmLockfileDetailed(jsonText: string): ParsedLockfile {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { status: 'malformed', entries: [] };
  }
  if (!isRawLockfile(raw)) return { status: 'malformed', entries: [] };
  const packages = raw.packages ?? {};
  const out: ParsedLockfileEntry[] = [];
  for (const key of Object.keys(packages)) {
    if (key === '') continue;
    const entry = packages[key];
    if (!entry || typeof entry.version !== 'string' || entry.version.length === 0) {
      continue;
    }
    const name = deriveName(key, entry);
    if (typeof name !== 'string' || name.length === 0) continue;
    const isTransitive = key.slice(TRANSITIVE_PREFIX.length).includes(TRANSITIVE_PREFIX);
    const licenses = normalizeLicenses(entry.license);
    const isDev = entry.dev === true;
    out.push({
      name,
      version: entry.version,
      isDev,
      isTransitive,
      licenses,
      ...(typeof entry.integrity === 'string' ? { integrity: entry.integrity } : {}),
    });
  }
  out.sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    if (a.version < b.version) return -1;
    if (a.version > b.version) return 1;
    return 0;
  });
  return { status: 'ok', entries: out };
}

function isRawLockfile(value: unknown): value is RawLockfile {
  return typeof value === 'object' && value !== null;
}

function deriveName(installPath: string, entry: RawLockfilePackage): string {
  if (typeof entry.name === 'string' && entry.name.length > 0) return entry.name;
  // Last `node_modules/<name>` segment of the install path.
  const parts = installPath.split(TRANSITIVE_PREFIX);
  const tail = parts[parts.length - 1];
  return typeof tail === 'string' && tail.length > 0 ? tail : '';
}

function normalizeLicenses(value: RawLockfilePackage['license']): ReadonlyArray<string> {
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const v of value) {
      if (typeof v === 'string' && v.length > 0) out.push(v);
    }
    return out;
  }
  return [];
}
