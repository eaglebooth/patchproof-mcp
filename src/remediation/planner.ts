/**
 * Remediation planner. Used by the `plan_remediation` tool (AC-2).
 * The full pure-function planner (severity × reachability ×
 * breaking-change risk, no fs writes) lands in AC-9; AC-2 wires
 * the tool to this function with a typed empty result.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import type { Remediation } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface PlanRemediationInput extends RunRepositoryScanInput {
  readonly maxSuggestions?: number | undefined;
  readonly riskTolerance?: 'low' | 'medium' | 'high' | undefined;
}

export interface PlanRemediationOutput {
  readonly repoRoot: string;
  readonly items: ReadonlyArray<Remediation>;
}

export async function planRemediations(
  ctx: ToolContext,
  input: PlanRemediationInput,
): Promise<PlanRemediationOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    items: [],
  };
}
