/**
 * `analyze_reachability` MCP tool. Classifies each vulnerability
 * finding as `confirmed | possible | unknown` with file:line
 * evidence. AC-2 wires the tool; AC-8 implements the import-graph
 * analyzer that produces the classification.
 */
import { z } from 'zod';

import { analyzeReachability } from '../reachability/analyzer.js';
import type { ReachabilityResult } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const analyzeReachabilityInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  findingIds: z.array(z.string().min(1)).optional(),
  includeTransitive: z.boolean().default(false),
});

export type AnalyzeReachabilityInput = z.infer<typeof analyzeReachabilityInputSchema>;

export interface AnalyzeReachabilityOutput {
  readonly repoRoot: string;
  readonly results: ReadonlyArray<ReachabilityResult>;
}

export const analyzeReachabilityTool: ToolDefinition = {
  name: 'analyze_reachability',
  description:
    'Classify each vulnerability finding as confirmed, possible, or unknown reachability with ' +
    'file:line evidence. A `confirmed` classification requires an import/require matching the ' +
    "vulnerable package's resolved path.",
  inputSchema: analyzeReachabilityInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<AnalyzeReachabilityOutput> => {
    const parsed = input as AnalyzeReachabilityInput;
    return analyzeReachability(ctx, {
      repoRoot: parsed.repoRoot,
      findingIds: parsed.findingIds,
      includeTransitive: parsed.includeTransitive,
    });
  },
};
