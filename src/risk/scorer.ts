import type {
  Dependency,
  OsvVulnerabilitySummary,
  RiskAssessment,
  RiskBand,
  Severity,
} from '../types/index.js';

const SEVERITY_SCORE: Readonly<Record<Severity, number>> = {
  critical: 100,
  high: 80,
  medium: 55,
  low: 25,
  unknown: 10,
};

/**
 * Transparent, deterministic risk model:
 *
 * base severity or CVSS score
 * x production/dev scope factor
 * x direct/transitive depth factor
 * x fix-availability factor
 *
 * A missing fix increases urgency; an available fix lowers residual
 * uncertainty but leaves the finding actionable.
 */
export function scoreDependencyRisk(
  dependency: Dependency,
  vulnerability: OsvVulnerabilitySummary,
): RiskAssessment {
  const severity = vulnerability.cvssScore === undefined
    ? SEVERITY_SCORE[vulnerability.severity]
    : clamp(vulnerability.cvssScore * 10, 0, 100);
  const dependencyScope = dependency.isDev ? 0.65 : 1;
  const dependencyDepth = dependency.isTransitive ? 0.8 : 1;
  const fixAvailability = vulnerability.fixedVersions.length > 0 ? 0.85 : 1;
  const score = Math.round(
    clamp(severity * dependencyScope * dependencyDepth * fixAvailability, 0, 100),
  );

  return {
    score,
    band: toBand(score),
    factors: {
      severity,
      dependencyScope,
      dependencyDepth,
      fixAvailability,
    },
    explanation: [
      `${vulnerability.severity} severity (${severity}/100 base)`,
      dependency.isDev ? 'development dependency (x0.65)' : 'production dependency (x1.00)',
      dependency.isTransitive ? 'transitive dependency (x0.80)' : 'direct dependency (x1.00)',
      vulnerability.fixedVersions.length > 0 ? 'fix available (x0.85)' : 'no fix available (x1.00)',
    ].join('; '),
  };
}

export function summarizeRisk(
  assessments: ReadonlyArray<RiskAssessment>,
): {
  readonly highestScore: number;
  readonly averageScore: number;
  readonly counts: Readonly<Record<RiskBand, number>>;
} {
  const counts: Record<RiskBand, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const assessment of assessments) counts[assessment.band] += 1;
  const total = assessments.reduce((sum, assessment) => sum + assessment.score, 0);
  return {
    highestScore: assessments.reduce((max, assessment) => Math.max(max, assessment.score), 0),
    averageScore: assessments.length === 0 ? 0 : Math.round(total / assessments.length),
    counts,
  };
}

function toBand(score: number): RiskBand {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
