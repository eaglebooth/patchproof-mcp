/**
 * `plan_remediation` MCP tool. Ranks remediation suggestions
 * (severity × reachability × breaking-change risk) and returns
 * the plan as data. AC-2 wires the tool; AC-9 implements the
 * pure-function planner. The tool never writes to disk.
 */
import { z } from 'zod';

import { planRemediations } from '../remediation/planner.js';
import type { Remediation } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const planRemediationInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  maxSuggestions: z.number().int().positive().max(500).default(50),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type PlanRemediationInput = z.infer<typeof planRemediationInputSchema>;

export interface PlanRemediationOutput {
  readonly repoRoot: string;
  readonly items: ReadonlyArray<Remediation>;
}

export const planRemediationTool: ToolDefinition = {
  name: 'plan_remediation',
  description:
    'Rank remediation suggestions by severity × reachability × breaking-change risk. Output is ' +
    'returned as data only — the tool never writes to disk. Each item lists the package, the ' +
    'current and recommended version, the breaking-change risk, the affected files, and the ' +
    'verification commands to run.',
  inputSchema: planRemediationInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<PlanRemediationOutput> => {
    const parsed = input as PlanRemediationInput;
    return planRemediations(ctx, {
      repoRoot: parsed.repoRoot,
      maxSuggestions: parsed.maxSuggestions,
      riskTolerance: parsed.riskTolerance,
    });
  },
};
