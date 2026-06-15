/** Dependency audit backed by deterministic fixtures or the live OSV API. */
import { z } from 'zod';

import { auditDependencies } from '../osv/audit.js';
import type { Dependency, OsvVulnerabilitySummary } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const auditDependenciesInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  osvMode: z.enum(['mock', 'live']).default('mock'),
  fallbackToMock: z.boolean().default(true),
  ecosystem: z.enum(['npm']).default('npm'),
});

export type AuditDependenciesInput = z.infer<typeof auditDependenciesInputSchema>;

export interface AuditDependenciesOutput {
  readonly repoRoot: string;
  readonly osvMode: 'mock' | 'live';
  readonly source: 'mock' | 'live' | 'mock-fallback';
  readonly lockfileStatus: 'ok' | 'missing' | 'malformed' | 'unreadable';
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
  readonly warnings: ReadonlyArray<string>;
}

export const auditDependenciesTool: ToolDefinition = {
  name: 'audit_dependencies',
  description:
    'Parse npm dependencies and query either the live OSV service or a deterministic local fixture. ' +
    'Live mode uses bounded timeout, retries, concurrency, caching, and an explicit fallback status.',
  inputSchema: auditDependenciesInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<AuditDependenciesOutput> => {
    const parsed = input as AuditDependenciesInput;
    return auditDependencies(ctx, {
      repoRoot: parsed.repoRoot,
      osvMode: parsed.osvMode,
      fallbackToMock: parsed.fallbackToMock,
      ecosystem: parsed.ecosystem,
    });
  },
};
