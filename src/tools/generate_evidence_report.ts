/**
 * `generate_evidence_report` MCP tool. Assembles a JSON report
 * (with `schemaVersion`, `generatedAt`, `inputs`, `findings`,
 * `remediation`, `verification`, `limitations`, `redactions`)
 * and a self-contained HTML report (no external assets, inline
 * CSS/JS, accessible markup). AC-2 wires the tool; AC-11
 * implements the JSON + HTML emitters.
 */
import { z } from 'zod';

import { generateReport } from '../reporting/generator.js';
import type { EvidenceReport } from '../types/index.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const generateEvidenceReportInputSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  format: z.enum(['json', 'html', 'both']).default('both'),
  includeHtmlPreview: z.boolean().default(false),
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
    'Assemble the final evidence report. The JSON form carries schemaVersion, generatedAt, ' +
    'inputs, findings, reachability, remediation, verification, limitations, and redactions. ' +
    'The HTML form is self-contained (no external assets, inline CSS/JS, accessible markup) ' +
    'and renders a stable layout suitable for review and audit.',
  inputSchema: generateEvidenceReportInputSchema,
  run: async (ctx: ToolContext, input: unknown): Promise<GenerateEvidenceReportOutput> => {
    const parsed = input as GenerateEvidenceReportInput;
    return generateReport(ctx, {
      repoRoot: parsed.repoRoot,
      format: parsed.format,
      includeHtmlPreview: parsed.includeHtmlPreview,
    });
  },
};
