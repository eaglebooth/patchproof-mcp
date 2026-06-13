/**
 * Verification runner. Used by the `verify_remediation` tool
 * (AC-2). The full allowlisted `child_process.spawn` runner
 * (command allowlist, arg validator, output cap, redactor) lands
 * in AC-10; AC-2 wires the tool to this function with a typed
 * empty result.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import type { VerificationResult } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface RunVerificationInput extends RunRepositoryScanInput {
  readonly commands?: ReadonlyArray<string> | undefined;
  readonly timeoutMs?: number | undefined;
}

export interface RunVerificationOutput {
  readonly repoRoot: string;
  readonly results: ReadonlyArray<VerificationResult>;
}

export const ALLOWLISTED_COMMANDS: ReadonlyArray<string> = [
  'npm test',
  'npm run lint',
  'npm run build',
  'npm audit --json',
];

export async function runVerifications(
  ctx: ToolContext,
  input: RunVerificationInput,
): Promise<RunVerificationOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    results: [],
  };
}
