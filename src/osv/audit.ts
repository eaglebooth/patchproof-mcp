/**
 * OSV audit orchestrator. Used by the `audit_dependencies` tool
 * (AC-2). The full OSV client (interface, live, mock, cache, rate
 * limit) lands in AC-6; AC-2 wires the tool to this function with
 * a typed empty result.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import type { Dependency, OsvVulnerabilitySummary } from '../types/index.js';
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

export async function auditDependencies(
  ctx: ToolContext,
  input: AuditDependenciesInput,
): Promise<AuditDependenciesOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    osvMode: input.osvMode ?? 'mock',
    dependencies: [],
    vulnerabilities: [],
  };
}
