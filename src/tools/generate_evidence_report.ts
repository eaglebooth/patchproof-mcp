/** End-to-end JSON and self-contained HTML evidence generation. */
import { z } from 'zod';

import { generateReport } from '../reporting/generator.js';
import type { EvidenceReport } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const generateEvidenceReportInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  format: z.enum(['json', 'html', 'both']).default('both'),
});

export type GenerateEvidenceReportInput = z.infer<typeof generateEvidenceReportInputSchema>;

export interface GenerateEvidenceReportOutput {
  readonly repoRoot: string;
  readonly format: 'json' | 'html' | 'both';
  readonly report: EvidenceReport;
  readonly html?: string;
}

export const generateEvidenceReportTool: ToolDefinition = {
  name: 'generate_evidence_report',
  description:
    'Combine the CycloneDX component inventory and deterministic vulnerability audit into JSON ' +
    'findings, upgrade recommendations, and a self-contained HTML report.',
  inputSchema: generateEvidenceReportInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<GenerateEvidenceReportOutput> => {
    const parsed = input as GenerateEvidenceReportInput;
    return generateReport(ctx, {
      repoRoot: parsed.repoRoot,
      format: parsed.format,
    });
  },
};
