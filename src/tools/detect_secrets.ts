/**
 * `detect_secrets` MCP tool. Walks the repository and returns
 * redacted secret fingerprints (no plaintext is ever returned).
 * AC-2 wires the tool; AC-7 implements the rule-based scanner
 * (AWS, GitHub PAT, Slack, private key, generic high-entropy) and
 * the layered redaction pass.
 */
import { z } from 'zod';

import { scanForSecrets } from '../scanners/secrets.js';
import type { SecretHit } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const detectSecretsInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  rules: z.array(z.string().min(1)).optional(),
  includeHidden: z.boolean().default(false),
  maxBytes: z.number().int().positive().max(524_288_000).default(524_288_000),
});

export type DetectSecretsInput = z.infer<typeof detectSecretsInputSchema>;

export interface DetectSecretsOutput {
  readonly repoRoot: string;
  readonly filesScanned: number;
  readonly hits: ReadonlyArray<SecretHit>;
}

export const detectSecretsTool: ToolDefinition = {
  name: 'detect_secrets',
  description:
    'Scan the repository for secrets using a rule-based engine. Output contains only redacted ' +
    'fingerprints, file paths, line ranges, rule IDs, categories, and confidence. Plaintext is ' +
    'never present in the return value, logs, or test snapshots.',
  inputSchema: detectSecretsInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<DetectSecretsOutput> => {
    const parsed = input as DetectSecretsInput;
    return scanForSecrets(ctx, {
      repoRoot: parsed.repoRoot,
      rules: parsed.rules,
      includeHidden: parsed.includeHidden,
      maxBytes: parsed.maxBytes,
    });
  },
};
