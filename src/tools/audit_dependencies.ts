/** Deterministic dependency audit backed by a local vulnerability fixture. */
import { z } from 'zod';

import { auditDependencies } from '../osv/audit.js';
import type { Dependency, OsvVulnerabilitySummary } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const auditDependenciesInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  osvMode: z.enum(['mock']).default('mock'),
  ecosystem: z.enum(['npm']).default('npm'),
});

export type AuditDependenciesInput = z.infer<typeof auditDependenciesInputSchema>;

export interface AuditDependenciesOutput {
  readonly repoRoot: string;
  readonly osvMode: 'mock';
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly vulnerabilities: ReadonlyArray<OsvVulnerabilitySummary>;
}

export const auditDependenciesTool: ToolDefinition = {
  name: 'audit_dependencies',
  description:
    'Parse npm dependencies and match them against a deterministic local vulnerability fixture. ' +
    'The tool performs no network requests and returns stable results for tests and demos.',
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
