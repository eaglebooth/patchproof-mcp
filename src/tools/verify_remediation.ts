/**
 * `verify_remediation` MCP tool. Runs allowlisted verification
 * commands (npm test, npm run lint, npm run build, npm audit
 * --json) against the repository. AC-2 wires the tool; AC-10
 * implements the `child_process.spawn` runner with the
 * arg/injection validator, output cap, and redactor.
 */
import { z } from 'zod';

import { runVerifications } from '../verification/runner.js';
import type { VerificationResult } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const verifyRemediationInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  commands: z
    .array(z.string().min(1))
    .default(['npm test', 'npm run lint', 'npm run build', 'npm audit --json']),
  timeoutMs: z.number().int().positive().max(600_000).default(120_000),
});

export type VerifyRemediationInput = z.infer<typeof verifyRemediationInputSchema>;

export interface VerifyRemediationOutput {
  readonly repoRoot: string;
  readonly results: ReadonlyArray<VerificationResult>;
}

export const verifyRemediationTool: ToolDefinition = {
  name: 'verify_remediation',
  description:
    'Run allowlisted verification commands against the repository. Only `npm test`, `npm run ' +
    'lint`, `npm run build`, and `npm audit --json` are accepted; redirections, pipes, shell ' +
    'metacharacters, absolute paths outside the root, and symlink escapes are rejected. Output ' +
    'is redacted and size-capped at 1 MiB per stream.',
  inputSchema: verifyRemediationInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<VerifyRemediationOutput> => {
    const parsed = input as VerifyRemediationInput;
    return runVerifications(ctx, {
      repoRoot: parsed.repoRoot,
      commands: parsed.commands,
      timeoutMs: parsed.timeoutMs,
    });
  },
};
