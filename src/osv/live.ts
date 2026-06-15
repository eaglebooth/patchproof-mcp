import { OsvError } from '../security/errors.js';
import type { Dependency, OsvVulnerabilitySummary, Severity } from '../types/index.js';
import { assessCvss } from './cvss.js';

const OSV_QUERY_URL = 'https://api.osv.dev/v1/query';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1_000;
const DEFAULT_CONCURRENCY = 8;

interface OsvAffected {
  readonly package?: { readonly ecosystem?: string; readonly name?: string };
  readonly ranges?: ReadonlyArray<{
    readonly type?: string;
    readonly events?: ReadonlyArray<{ readonly fixed?: string }>;
  }>;
  readonly database_specific?: { readonly severity?: string };
}

interface OsvApiVulnerability {
  readonly id?: string;
  readonly aliases?: ReadonlyArray<string>;
  readonly summary?: string;
  readonly details?: string;
  readonly severity?: ReadonlyArray<{ readonly type?: string; readonly score?: string }>;
  readonly affected?: ReadonlyArray<OsvAffected>;
  readonly database_specific?: { readonly severity?: string };
}

interface OsvQueryResponse {
  readonly vulns?: ReadonlyArray<OsvApiVulnerability>;
}

export interface LiveOsvOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly cacheTtlMs?: number;
  readonly concurrency?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly signal?: AbortSignal;
}

export interface OsvDependencyMatch {
  readonly dependency: Dependency;
  readonly vulnerability: OsvVulnerabilitySummary;
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
}

const cache = new Map<string, CacheEntry>();

export async function queryLiveOsv(
  dependencies: ReadonlyArray<Dependency>,
  options: LiveOsvOptions = {},
): Promise<ReadonlyArray<OsvDependencyMatch>> {
  const concurrency = positiveInteger(options.concurrency, DEFAULT_CONCURRENCY);
  const uniqueDependencies = deduplicateDependencies(dependencies);
  const matches: OsvDependencyMatch[] = [];

  for (let offset = 0; offset < uniqueDependencies.length; offset += concurrency) {
    const batch = uniqueDependencies.slice(offset, offset + concurrency);
    const results = await Promise.all(
      batch.map(async (dependency) => ({
        dependency,
        vulnerabilities: await queryDependency(dependency, options),
      })),
    );
    for (const result of results) {
      for (const vulnerability of result.vulnerabilities) {
        matches.push({ dependency: result.dependency, vulnerability });
      }
    }
  }

  return matches.sort((a, b) => {
    const packageDelta = a.dependency.name.localeCompare(b.dependency.name);
    return packageDelta !== 0 ? packageDelta : a.vulnerability.id.localeCompare(b.vulnerability.id);
  });
}

export function clearOsvCache(): void {
  cache.clear();
}

async function queryDependency(
  dependency: Dependency,
  options: LiveOsvOptions,
): Promise<ReadonlyArray<OsvVulnerabilitySummary>> {
  const now = options.now ?? Date.now;
  const cacheKey = `${dependency.name}@${dependency.version}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now()) return cached.vulnerabilities;

  const payload = await requestOsv(
    {
      package: { ecosystem: 'npm', name: dependency.name },
      version: dependency.version,
    },
    options,
  );
  const vulnerabilities = (payload.vulns ?? [])
    .map((vulnerability) => normalizeVulnerability(vulnerability, dependency.name))
    .filter((vulnerability): vulnerability is OsvVulnerabilitySummary => vulnerability !== null);
  cache.set(cacheKey, {
    expiresAt: now() + positiveInteger(options.cacheTtlMs, DEFAULT_CACHE_TTL_MS),
    vulnerabilities,
  });
  return vulnerabilities;
}

async function requestOsv(body: unknown, options: LiveOsvOptions): Promise<OsvQueryResponse> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const retries = nonNegativeInteger(options.retries, DEFAULT_RETRIES);
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted === true) controller.abort();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(OSV_QUERY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new OsvError(`OSV returned HTTP ${response.status}`, { status: response.status });
      }
      return (await response.json()) as OsvQueryResponse;
    } catch (error: unknown) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(100 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }

  throw new OsvError('Live OSV query failed after bounded retries', {
    cause: lastError instanceof Error ? lastError.message : String(lastError),
    retries,
    timeoutMs,
  });
}

function deduplicateDependencies(
  dependencies: ReadonlyArray<Dependency>,
): ReadonlyArray<Dependency> {
  const selected = new Map<string, Dependency>();
  for (const dependency of dependencies) {
    const key = `${dependency.name}@${dependency.version}`;
    const current = selected.get(key);
    if (!current || dependencyPriority(dependency) > dependencyPriority(current)) {
      selected.set(key, dependency);
    }
  }
  return [...selected.values()];
}

function dependencyPriority(dependency: Dependency): number {
  return (dependency.isDev ? 0 : 2) + (dependency.isTransitive ? 0 : 1);
}

function normalizeVulnerability(
  vulnerability: OsvApiVulnerability,
  packageName: string,
): OsvVulnerabilitySummary | null {
  if (typeof vulnerability.id !== 'string' || vulnerability.id.length === 0) return null;
  const affected = (vulnerability.affected ?? []).filter(
    (item) =>
      item.package?.name === packageName &&
      (item.package.ecosystem?.toLowerCase() === 'npm' || item.package.ecosystem === undefined),
  );
  const fixedVersions = new Set<string>();
  for (const item of affected) {
    for (const range of item.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (typeof event.fixed === 'string' && event.fixed.length > 0) {
          fixedVersions.add(event.fixed);
        }
      }
    }
  }

  const vector = vulnerability.severity?.find((entry) => entry.type?.startsWith('CVSS'))?.score;
  const cvss = assessCvss(vector);
  const severity =
    cvss.severity !== 'unknown'
      ? cvss.severity
      : normalizeSeverity(
          affected.find((item) => item.database_specific?.severity)?.database_specific?.severity ??
            vulnerability.database_specific?.severity,
        );
  const summary = firstNonEmpty(vulnerability.summary, vulnerability.details, vulnerability.id);

  return {
    id: vulnerability.id,
    aliases: [...(vulnerability.aliases ?? [])].sort(),
    summary,
    severity,
    ...(cvss.score !== undefined ? { cvssScore: cvss.score } : {}),
    fixedVersions: [...fixedVersions].sort(compareVersions),
  };
}

function normalizeSeverity(value: string | undefined): Severity {
  switch (value?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'unknown';
  }
}

function firstNonEmpty(...values: ReadonlyArray<string | undefined>): string {
  return (
    values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? 'OSV finding'
  );
}

function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? (value as number) : fallback;
}
