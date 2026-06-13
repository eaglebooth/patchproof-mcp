/**
 * Secret scanner. Used by the `detect_secrets` tool (AC-2) and
 * indirectly by `generate_evidence_report` (AC-11).
 *
 * AC-2 wires the tool to this function with a typed empty result.
 * The full rule-based scanner (AWS, GitHub PAT, Slack, private
 * key, generic high-entropy) is implemented in AC-7.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import type { SecretHit } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface ScanForSecretsInput extends RunRepositoryScanInput {
  readonly rules?: ReadonlyArray<string> | undefined;
}

export interface ScanForSecretsOutput {
  readonly repoRoot: string;
  readonly filesScanned: number;
  readonly hits: ReadonlyArray<SecretHit>;
}

export async function scanForSecrets(
  ctx: ToolContext,
  input: ScanForSecretsInput,
): Promise<ScanForSecretsOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    filesScanned: 0,
    hits: [],
  };
}
