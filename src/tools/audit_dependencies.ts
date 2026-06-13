/**
 * `audit_dependencies` MCP tool. Walks the repository's
 * dependency graph and queries OSV for known vulnerabilities.
 * AC-2 wires the tool; AC-6 implements the live/mock OSV client
 * with timeout, retry, cache, and rate limit.
 */
import { z } from 'zod';

import { auditDependencies } from '../osv/audit.js';
import type { Dependency, OsvVulnerabilitySummary } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const auditDependenciesInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  osvMode: z.enum(['mock', 'live']).default('mock'),
  ecosystem: z.enum(['npm']).default('npm'),
});

export type AuditDependenciesInput = z.infer<typeof auditDependenciesInputSchema>;

export interface AuditDependenciesOutput {
  readonly repoRoot: string;
  readonly osvMode: 'mock' | 'live';
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
}

export const auditDependenciesTool: ToolDefinition = {
  name: 'audit_dependencies',
  description:
    'Audit the repository dependencies against OSV (api.osv.dev). Supports a deterministic mock ' +
    'adapter (default, no network) and a live adapter (timeout, bounded retry, TTL cache, ' +
    'sliding-window rate limit). Returns the dependency list and the matched vulnerabilities.',
  inputSchema: auditDependenciesInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<AuditDependenciesOutput> => {
    const parsed = input as AuditDependenciesInput;
    return auditDependencies(ctx, {
      repoRoot: parsed.repoRoot,
      osvMode: parsed.osvMode,
      ecosystem: parsed.ecosystem,
    });
  },
};
