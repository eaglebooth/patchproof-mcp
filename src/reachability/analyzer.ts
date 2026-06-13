/**
 * Reachability analyzer. Used by the `analyze_reachability` tool
 * (AC-2). The full import-graph analysis (resolved path match,
 * string-literal match, classification: confirmed | possible |
 * unknown) lands in AC-8; AC-2 wires the tool to this function
 * with a typed empty result.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import type { ReachabilityResult } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface AnalyzeReachabilityInput extends RunRepositoryScanInput {
  readonly findingIds?: ReadonlyArray<string> | undefined;
  readonly includeTransitive?: boolean | undefined;
}

export interface AnalyzeReachabilityOutput {
  readonly repoRoot: string;
  readonly results: ReadonlyArray<ReachabilityResult>;
}

export async function analyzeReachability(
  ctx: ToolContext,
  input: AnalyzeReachabilityInput,
): Promise<AnalyzeReachabilityOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    results: [],
  };
}
