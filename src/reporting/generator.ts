/**
 * Evidence report generator used by the MCP tool and demo API.
 *
 * The report composes SBOM, OSV, reachability, remediation, and optional
 * allowlisted verification into one inspectable JSON/HTML artifact.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { buildCycloneDxSbom } from '../sbom/cyclonedx.js';
import { auditDependencies } from '../osv/audit.js';
import { analyzeReachability } from '../reachability/analyzer.js';
import { planRemediation } from '../remediation/planner.js';
import { scoreDependencyRisk, summarizeRisk } from '../risk/scorer.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import { systemClock } from '../utils/clock.js';
import { runVerificationPlan } from '../verification/runner.js';
import type { EvidenceReport, Finding } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface GenerateEvidenceReportInput extends RunRepositoryScanInput {
  readonly format?: 'json' | 'html' | 'both' | undefined;
  readonly osvMode?: 'mock' | 'live' | undefined;
  readonly fallbackToMock?: boolean | undefined;
  readonly verify?: boolean | undefined;
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
  const [sbom, audit] = await Promise.all([
    buildCycloneDxSbom(ctx, { repoRoot: root }),
    auditDependencies(ctx, {
      repoRoot: root,
      ecosystem: 'npm',
      osvMode: input.osvMode ?? 'mock',
      fallbackToMock: input.fallbackToMock ?? true,
    }),
  ]);
  const findings = [...toLockfileFindings(sbom.lockfileStatus), ...toFindings(audit.matches)];
  const reachability = await analyzeReachability(root, findings);
  const remediation = planRemediation(findings, reachability);
  const verificationPlan = [...new Set(remediation.flatMap((item) => item.verificationCommands))];
  const verification =
    input.verify === true ? await runVerificationPlan(root, verificationPlan) : [];
  const limitations = [...audit.warnings];
  if (audit.source === 'mock') {
    limitations.push(
      'Deterministic mock OSV mode was selected; use osvMode=live to query api.osv.dev.',
    );
  }
  if (input.verify !== true) {
    limitations.push(
      'Verification commands were planned but not executed; set verify=true for the allowlisted local checks.',
    );
  }
  if (sbom.lockfileStatus !== 'ok') {
    limitations.push(
      `package-lock.json status is ${sbom.lockfileStatus}; dependency-derived output is incomplete.`,
    );
  }
  const report: EvidenceReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: systemClock.iso(),
    inputs: {
      repoRoot: root,
      config: {
        ecosystem: 'npm',
        auditMode: audit.osvMode,
        auditSource: audit.source,
        lockfileStatus: sbom.lockfileStatus,
        sbomSchemaVersion: sbom.schemaVersion,
        sbomSerialNumber: sbom.serialNumber,
        componentCount: sbom.components.length,
        dependencyCount: audit.dependencies.length,
        vulnerabilityCount: findings.length,
      },
    },
    findings,
    riskSummary: summarizeRisk(findings.flatMap((finding) => (finding.risk ? [finding.risk] : []))),
    reachability,
    remediation,
    verification,
    verificationPlan,
    limitations,
    redactions: [],
  };
  const out: {
    repoRoot: string;
    format: 'json' | 'html' | 'both';
    report: EvidenceReport;
    html?: string;
  } = {
    repoRoot: root,
    format,
    report,
  };
  if (format === 'html' || format === 'both') {
    out.html = renderHtml(report);
  }
  return out;
}

function toLockfileFindings(
  status: Awaited<ReturnType<typeof buildCycloneDxSbom>>['lockfileStatus'],
): Finding[] {
  if (status === 'ok') return [];
  if (status === 'missing') {
    return [
      {
        id: 'lockfile:missing',
        kind: 'missing',
        message: 'package-lock.json is missing; dependency evidence could not be generated.',
        severity: 'medium',
      },
    ];
  }
  return [
    {
      id: `lockfile:${status}`,
      kind: 'malformed',
      message:
        status === 'malformed'
          ? 'package-lock.json is malformed and could not be parsed.'
          : 'package-lock.json exists but could not be read.',
      severity: 'medium',
    },
  ];
}

function toFindings(matches: Awaited<ReturnType<typeof auditDependencies>>['matches']): Finding[] {
  const findings: Finding[] = matches.map(({ dependency, vulnerability }) => ({
    id: `${dependency.name}@${dependency.version}:${vulnerability.id}`,
    kind: 'vulnerability',
    dependency: { name: dependency.name, version: dependency.version },
    vulnerability,
    message: `${dependency.name}@${dependency.version}: ${vulnerability.summary}`,
    severity: vulnerability.severity,
    risk: scoreDependencyRisk(dependency, vulnerability),
  }));
  return findings.sort((a, b) => {
    const scoreDelta = (b.risk?.score ?? 0) - (a.risk?.score ?? 0);
    return scoreDelta !== 0 ? scoreDelta : a.id.localeCompare(b.id);
  });
}

export function renderHtml(report: EvidenceReport): string {
  const json = JSON.stringify(report, null, 2);
  const escaped = escapeHtml(json);
  const componentCount = Number(report.inputs.config['componentCount'] ?? 0);
  const vulnerabilityCount = Number(report.inputs.config['vulnerabilityCount'] ?? 0);
  const confirmedReachability = report.reachability.filter(
    (item) => item.classification === 'confirmed',
  ).length;
  const passedVerification = report.verification.filter((item) => item.exitCode === 0).length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PatchProof Evidence Report</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #fafafa; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem 0; }
  p.meta { color: #555; font-size: 0.875rem; margin: 0 0 1rem 0; }
  .summary { display: flex; gap: 1rem; margin: 1rem 0; }
  .metric { background: #fff; border: 1px solid #ddd; padding: 0.75rem 1rem; min-width: 9rem; }
  .metric strong { display: block; font-size: 1.5rem; }
  pre { background: #fff; border: 1px solid #ddd; padding: 1rem; overflow: auto; font-size: 0.8125rem; }
</style>
</head>
<body>
<h1>PatchProof Evidence Report</h1>
<p class="meta">schemaVersion: ${escapeHtml(report.schemaVersion)} &middot; generatedAt: ${escapeHtml(report.generatedAt)}</p>
<section class="summary" aria-label="Audit summary">
  <div class="metric"><strong>${componentCount}</strong>SBOM components</div>
  <div class="metric"><strong>${vulnerabilityCount}</strong>vulnerabilities</div>
  <div class="metric"><strong>${report.riskSummary.highestScore}</strong>highest risk</div>
  <div class="metric"><strong>${confirmedReachability}</strong>confirmed reachable</div>
  <div class="metric"><strong>${report.remediation.length}</strong>remediations</div>
  <div class="metric"><strong>${passedVerification}/${report.verification.length}</strong>checks passed</div>
</section>
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
