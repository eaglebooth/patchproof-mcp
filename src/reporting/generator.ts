/**
 * Evidence report generator used by the MCP tool and demo API.
 *
 * The report composes the implemented SBOM and deterministic
 * vulnerability audit into one inspectable JSON/HTML artifact.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { buildCycloneDxSbom } from '../sbom/cyclonedx.js';
import { auditDependencies, MOCK_VULNS } from '../osv/audit.js';
import { scoreDependencyRisk, summarizeRisk } from '../risk/scorer.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import { systemClock } from '../utils/clock.js';
import type { EvidenceReport, Finding, Remediation } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface GenerateEvidenceReportInput extends RunRepositoryScanInput {
  readonly format?: 'json' | 'html' | 'both' | undefined;
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
    auditDependencies(ctx, { repoRoot: root, ecosystem: 'npm', osvMode: 'mock' }),
  ]);
  const findings = [...toLockfileFindings(sbom.lockfileStatus), ...toFindings(audit.dependencies)];
  const remediation = toRemediation(findings);
  const limitations = [
    'Vulnerability matching uses a deterministic local fixture table and does not query the live OSV service.',
    'Reachability analysis and verification command execution are not implemented in this four-tool MVP.',
  ];
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
    reachability: [],
    remediation,
    verification: [],
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

function toFindings(
  dependencies: Awaited<ReturnType<typeof auditDependencies>>['dependencies'],
): Finding[] {
  const findings: Finding[] = [];
  for (const dependency of dependencies) {
    const vulnerabilities = MOCK_VULNS.get(`${dependency.name}@${dependency.version}`) ?? [];
    for (const vulnerability of vulnerabilities) {
      findings.push({
        id: `${dependency.name}@${dependency.version}:${vulnerability.id}`,
        kind: 'vulnerability',
        dependency: { name: dependency.name, version: dependency.version },
        vulnerability: {
          id: vulnerability.id,
          aliases: vulnerability.aliases ?? [],
          summary: vulnerability.summary,
          severity: vulnerability.severity,
          ...(typeof vulnerability.cvssScore === 'number'
            ? { cvssScore: vulnerability.cvssScore }
            : {}),
          fixedVersions: vulnerability.fixedVersions,
        },
        message: `${dependency.name}@${dependency.version}: ${vulnerability.summary}`,
        severity: vulnerability.severity,
        risk: scoreDependencyRisk(dependency, {
          id: vulnerability.id,
          aliases: vulnerability.aliases ?? [],
          summary: vulnerability.summary,
          severity: vulnerability.severity,
          ...(typeof vulnerability.cvssScore === 'number'
            ? { cvssScore: vulnerability.cvssScore }
            : {}),
          fixedVersions: vulnerability.fixedVersions,
        }),
      });
    }
  }
  return findings.sort((a, b) => {
    const scoreDelta = (b.risk?.score ?? 0) - (a.risk?.score ?? 0);
    return scoreDelta !== 0 ? scoreDelta : a.id.localeCompare(b.id);
  });
}

function toRemediation(findings: ReadonlyArray<Finding>): Remediation[] {
  return findings.flatMap((finding) => {
    const dependency = finding.dependency;
    const recommendedVersion = finding.vulnerability?.fixedVersions[0];
    if (!dependency || !recommendedVersion) return [];
    return [
      {
        package: dependency.name,
        currentVersion: dependency.version,
        recommendedVersion,
        breakingChangeRisk: 'low' as const,
        affectedFiles: ['package.json', 'package-lock.json'],
        verificationCommands: ['npm run typecheck', 'npm test', 'npm run build'],
        rationale: `Upgrade to a version that fixes ${finding.vulnerability?.id ?? finding.id}.`,
      },
    ];
  });
}

export function renderHtml(report: EvidenceReport): string {
  const json = JSON.stringify(report, null, 2);
  const escaped = escapeHtml(json);
  const componentCount = Number(report.inputs.config['componentCount'] ?? 0);
  const vulnerabilityCount = Number(report.inputs.config['vulnerabilityCount'] ?? 0);
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
  <div class="metric"><strong>${report.remediation.length}</strong>remediations</div>
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
