/**
 * Evidence report generator. Used by the `generate_evidence_report`
 * tool (AC-2) and the demo API (AC-19). The full JSON + self-
 * contained HTML emitter lands in AC-11; AC-2 wires the tool to
 * this function with a typed empty result.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import type { EvidenceReport } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface GenerateEvidenceReportInput extends RunRepositoryScanInput {
  readonly format?: 'json' | 'html' | 'both' | undefined;
  readonly includeHtmlPreview?: boolean | undefined;
}

export interface GenerateEvidenceReportOutput {
  readonly repoRoot: string;
  readonly format: 'json' | 'html' | 'both';
  readonly report: EvidenceReport;
  readonly html?: string;
}

export async function generateReport(
  ctx: ToolContext,
  input: GenerateEvidenceReportInput,
): Promise<GenerateEvidenceReportOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  const format = input.format ?? 'both';
  const report: EvidenceReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '1970-01-01T00:00:00.000Z',
    inputs: { repoRoot: root, config: {} },
    findings: [],
    reachability: [],
    remediation: [],
    verification: [],
    limitations: ['AC-2 scaffold: report is empty until AC-11 is implemented.'],
    redactions: [],
  };
  const out: { repoRoot: string; format: 'json' | 'html' | 'both'; report: EvidenceReport; html?: string } = {
    repoRoot: root,
    format,
    report,
  };
  if (format === 'html' || format === 'both') {
    out.html = '';
  }
  return out;
}
