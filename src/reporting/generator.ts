/**
 * Evidence report generator. Used by the `generate_evidence_report`
 * tool (AC-2) and the demo API (AC-19).
 *
 * AC-2 implements the typed report assembly. The JSON form
 * carries `schemaVersion`, `generatedAt`, `inputs`, `findings`,
 * `reachability`, `remediation`, `verification`, `limitations`,
 * and `redactions`. The HTML form is a self-contained document
 * (no external assets, inline CSS) that renders the JSON inside
 * a `<pre>` for review and audit. The richer report layout
 * (sections, tables, navigation) lands in AC-11; AC-2 only
 * needs a self-contained HTML preview.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import { systemClock } from '../utils/clock.js';
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

const HTML_LIMITATIONS = 'AC-2 scaffold: HTML preview is a self-contained <pre> dump of the JSON report; the full layout (sections, tables, navigation) lands in AC-11.';

export async function generateReport(
  ctx: ToolContext,
  input: GenerateEvidenceReportInput,
): Promise<GenerateEvidenceReportOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  const format = input.format ?? 'both';
  const inputsConfig: Record<string, unknown> = {};
  const limitations: string[] = [HTML_LIMITATIONS];
  try {
    const stat = await fs.stat(path.join(root, 'package-lock.json'));
    inputsConfig['lockfileSizeBytes'] = stat.size;
  } catch {
    limitations.push('No package-lock.json found at the repository root; SBOM and OSV audit results are empty.');
  }
  const report: EvidenceReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: systemClock.iso(),
    inputs: { repoRoot: root, config: inputsConfig },
    findings: [],
    reachability: [],
    remediation: [],
    verification: [],
    limitations,
    redactions: [],
  };
  const out: { repoRoot: string; format: 'json' | 'html' | 'both'; report: EvidenceReport; html?: string } = {
    repoRoot: root,
    format,
    report,
  };
  if (format === 'html' || format === 'both') {
    out.html = renderHtml(report);
  }
  return out;
}

function renderHtml(report: EvidenceReport): string {
  const json = JSON.stringify(report, null, 2);
  const escaped = escapeHtml(json);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PatchProof Evidence Report</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #fafafa; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem 0; }
  p.meta { color: #555; font-size: 0.875rem; margin: 0 0 1rem 0; }
  pre { background: #fff; border: 1px solid #ddd; padding: 1rem; overflow: auto; font-size: 0.8125rem; }
</style>
</head>
<body>
<h1>PatchProof Evidence Report</h1>
<p class="meta">schemaVersion: ${escapeHtml(report.schemaVersion)} &middot; generatedAt: ${escapeHtml(report.generatedAt)}</p>
<pre>${escaped}</pre>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
