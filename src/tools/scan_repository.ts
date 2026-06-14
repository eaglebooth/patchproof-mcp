/** Bounded repository traversal and file statistics. */
import { z } from 'zod';

import { runRepositoryScan } from '../scanners/files.js';
import type { Finding } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const scanRepositoryInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  includeHidden: z.boolean().default(false),
  followSymlinks: z.boolean().default(false),
  maxFiles: z.number().int().positive().max(50_000).default(50_000),
  maxBytes: z.number().int().positive().max(524_288_000).default(524_288_000),
  maxDepth: z.number().int().positive().max(10).default(10),
});

export type ScanRepositoryInput = z.infer<typeof scanRepositoryInputSchema>;

export interface ScanRepositoryOutput {
  readonly repoRoot: string;
  readonly filesScanned: number;
  readonly bytesRead: number;
  readonly durationMs: number;
  readonly truncated: boolean;
  readonly truncationReason?: string;
  readonly findings: ReadonlyArray<Finding>;
  readonly ignoreDirs: ReadonlyArray<string>;
}

export const scanRepositoryTool: ToolDefinition = {
  name: 'scan_repository',
  description:
    'Walk a repository root and return bounded file-count and byte-count statistics. Paths are ' +
    'resolved inside the authorized root and traversal is limited by file, byte, and depth caps.',
  inputSchema: scanRepositoryInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<ScanRepositoryOutput> => {
    const parsed = input as ScanRepositoryInput;
    return runRepositoryScan(ctx, {
      repoRoot: parsed.repoRoot,
      includeHidden: parsed.includeHidden,
      followSymlinks: parsed.followSymlinks,
      maxFiles: parsed.maxFiles,
      maxBytes: parsed.maxBytes,
      maxDepth: parsed.maxDepth,
    });
  },
};
