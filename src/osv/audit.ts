/** Dependency audit with deterministic mock and bounded live OSV modes. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { parseNpmLockfileDetailed, type ParsedLockfileEntry } from '../parsers/lockfile.js';
import type { LockfileStatus } from '../sbom/cyclonedx.js';
import type { Dependency, OsvVulnerabilitySummary, Severity } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';
import { queryLiveOsv, type LiveOsvOptions, type OsvDependencyMatch } from './live.js';

export interface AuditDependenciesInput extends RunRepositoryScanInput {
  readonly osvMode?: 'mock' | 'live' | undefined;
  readonly fallbackToMock?: boolean | undefined;
  readonly ecosystem?: 'npm' | undefined;
  readonly liveOptions?: LiveOsvOptions | undefined;
}

export interface AuditDependenciesOutput {
  readonly repoRoot: string;
  readonly osvMode: 'mock' | 'live';
  readonly source: 'mock' | 'live' | 'mock-fallback';
  readonly lockfileStatus: LockfileStatus;
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
  readonly matches: ReadonlyArray<OsvDependencyMatch>;
  readonly warnings: ReadonlyArray<string>;
}

const LOCKFILE_BASENAME = 'package-lock.json';

interface MockVuln {
  readonly id: string;
  readonly aliases?: ReadonlyArray<string>;
  readonly summary: string;
  readonly severity: Severity;
  readonly cvssScore?: number;
  readonly fixedVersions: ReadonlyArray<string>;
}

/**
 * Deterministic in-file OSV mock. The keys are exactly the
 * `name@version` strings that `parseNpmLockfile` produces; the
 * values are the synthetic vulnerability summaries the audit
 * would return. Add or remove entries here to expand the
 * coverage; the rest of the pipeline does not need to change.
 */
export const MOCK_VULNS: ReadonlyMap<string, ReadonlyArray<MockVuln>> = new Map<
  string,
  ReadonlyArray<MockVuln>
>([
  [
    'lodash@4.17.20',
    [
      {
        id: 'GHSA-xxxx-yyyy-zzzz',
        aliases: ['CVE-2021-23337'],
        summary: 'Command injection via template',
        severity: 'high',
        cvssScore: 7.2,
        fixedVersions: ['4.17.21'],
      },
    ],
  ],
  [
    'minimatch@3.0.4',
    [
      {
        id: 'GHSA-aaaa-bbbb-cccc',
        aliases: ['CVE-2022-3517'],
        summary: 'ReDoS in minimatch',
        severity: 'medium',
        cvssScore: 5.3,
        fixedVersions: ['3.1.2'],
      },
    ],
  ],
  [
    'ms@2.1.2',
    [
      {
        id: 'GHSA-dddd-eeee-ffff',
        summary: 'Prototype pollution',
        severity: 'low',
        fixedVersions: ['2.1.3'],
      },
    ],
  ],
]);

export async function auditDependencies(
  ctx: ToolContext,
  input: AuditDependenciesInput,
): Promise<AuditDependenciesOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  let entries: ReadonlyArray<ParsedLockfileEntry> = [];
  let lockfileStatus: LockfileStatus = 'missing';
  try {
    const lockfileText = await fs.readFile(path.join(root, LOCKFILE_BASENAME), 'utf8');
    const parsed = parseNpmLockfileDetailed(lockfileText);
    entries = parsed.entries;
    lockfileStatus = parsed.status;
  } catch (error: unknown) {
    lockfileStatus = isMissingFile(error) ? 'missing' : 'unreadable';
    entries = [];
  }

  const dependencies: Dependency[] = entries.map((e) => ({
    name: e.name,
    version: e.version,
    ecosystem: 'npm',
    isDev: e.isDev,
    isTransitive: e.isTransitive,
    ...(typeof e.integrity === 'string' ? { integrity: e.integrity } : {}),
    ...(e.licenses.length > 0 ? { licenses: e.licenses } : {}),
    purl: `pkg:npm/${e.name}@${e.version}`,
  }));

  const requestedMode = input.osvMode ?? 'mock';
  if (requestedMode === 'live') {
    try {
      const matches = await queryLiveOsv(dependencies, {
        ...input.liveOptions,
        signal: ctx.signal,
      });
      return {
        repoRoot: root,
        osvMode: 'live',
        source: 'live',
        lockfileStatus,
        dependencies,
        vulnerabilities: matches.map((match) => match.vulnerability),
        matches,
        warnings: [],
      };
    } catch (error: unknown) {
      if (input.fallbackToMock === false) throw error;
      const matches = buildMockMatches(dependencies);
      return {
        repoRoot: root,
        osvMode: 'live',
        source: 'mock-fallback',
        lockfileStatus,
        dependencies,
        vulnerabilities: matches.map((match) => match.vulnerability),
        matches,
        warnings: [
          `Live OSV was unavailable; deterministic mock fallback was used: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  const matches = buildMockMatches(dependencies);
  return {
    repoRoot: root,
    osvMode: 'mock',
    source: 'mock',
    lockfileStatus,
    dependencies,
    vulnerabilities: matches.map((match) => match.vulnerability),
    matches,
    warnings: [],
  };
}

function buildMockMatches(
  dependencies: ReadonlyArray<Dependency>,
): ReadonlyArray<OsvDependencyMatch> {
  const matches: OsvDependencyMatch[] = [];
  for (const dep of dependencies) {
    const key = `${dep.name}@${dep.version}`;
    const mock = MOCK_VULNS.get(key);
    if (!mock) continue;
    for (const v of mock) {
      matches.push({
        dependency: dep,
        vulnerability: {
          id: v.id,
          aliases: v.aliases ?? [],
          summary: v.summary,
          severity: v.severity,
          ...(typeof v.cvssScore === 'number' ? { cvssScore: v.cvssScore } : {}),
          fixedVersions: v.fixedVersions,
        },
      });
    }
  }
  return matches;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
