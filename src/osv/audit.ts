/**
 * OSV audit orchestrator. Used by the `audit_dependencies` tool
 * (AC-2).
 *
 * AC-2 implements the deterministic mock adapter. The mock is a
 * pure in-memory `MOCK_VULNS` map keyed by `name@version`; no
 * `fetch` / `http` / `child_process` calls happen on the mock
 * path, which keeps the test suite free of network dependencies.
 *
 * The `osvMode: 'live'` switch is accepted by the input schema
 * and the live adapter is reserved for a future run; this
 * implementation always resolves the mock table regardless of
 * mode. A later AC will split out a real HTTP client.
 */
import * as path from 'node:path';

import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { parseNpmLockfile } from '../parsers/lockfile.js';
import type { Dependency, OsvVulnerabilitySummary, Severity } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface AuditDependenciesInput extends RunRepositoryScanInput {
  readonly osvMode?: 'mock' | 'live' | undefined;
  readonly ecosystem?: 'npm' | undefined;
}

export interface AuditDependenciesOutput {
  readonly repoRoot: string;
  readonly osvMode: 'mock' | 'live';
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
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
export const MOCK_VULNS: ReadonlyMap<string, ReadonlyArray<MockVuln>> = new Map<string, ReadonlyArray<MockVuln>>([
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
  const mode = input.osvMode ?? 'mock';

  let entries: ReadonlyArray<ReturnType<typeof parseNpmLockfile>[number]> = [];
  try {
    const fs = await import('node:fs');
    const lockfileText = fs.readFileSync(path.join(root, LOCKFILE_BASENAME), 'utf8');
    entries = parseNpmLockfile(lockfileText);
  } catch {
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

  const vulnerabilities: OsvVulnerabilitySummary[] = [];
  for (const dep of entries) {
    const key = `${dep.name}@${dep.version}`;
    const mock = MOCK_VULNS.get(key);
    if (!mock) continue;
    for (const v of mock) {
      vulnerabilities.push({
        id: v.id,
        aliases: v.aliases ?? [],
        summary: v.summary,
        severity: v.severity,
        ...(typeof v.cvssScore === 'number' ? { cvssScore: v.cvssScore } : {}),
        fixedVersions: v.fixedVersions,
      });
    }
  }

  return {
    repoRoot: root,
    // Mock-only path: `live` is reserved for a future run.
    osvMode: mode === 'live' ? 'live' : 'mock',
    dependencies,
    vulnerabilities,
  };
}
