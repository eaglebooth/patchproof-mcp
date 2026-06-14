/** Deterministic CycloneDX 1.5-shaped SBOM generation. */
import { z } from 'zod';

import { buildCycloneDxSbom } from '../sbom/cyclonedx.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const generateSbomInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  format: z.enum(['cyclonedx']).default('cyclonedx'),
});

export type GenerateSbomInput = z.infer<typeof generateSbomInputSchema>;

export interface GenerateSbomOutput {
  readonly repoRoot: string;
  readonly format: 'cyclonedx';
  readonly schemaVersion: '1.5';
  readonly serialNumber: string;
  readonly lockfileStatus: 'ok' | 'missing' | 'malformed' | 'unreadable';
  readonly components: ReadonlyArray<{
    readonly type: 'library';
    readonly name: string;
    readonly version: string;
    readonly purl: string;
    readonly licenses: ReadonlyArray<string>;
  }>;
}

export const generateSbomTool: ToolDefinition = {
  name: 'generate_sbom',
  description:
    'Build a CycloneDX 1.5 SBOM for the repository. Components include name, version, purl, and ' +
    'declared licenses when available. The serial number is content-addressed from package-lock.json.',
  inputSchema: generateSbomInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<GenerateSbomOutput> => {
    const parsed = input as GenerateSbomInput;
    return buildCycloneDxSbom(ctx, { repoRoot: parsed.repoRoot, format: parsed.format });
  },
};
