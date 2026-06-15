import type { Severity } from '../types/index.js';

const ROUND_UP_MULTIPLIER = 10;

export interface CvssAssessment {
  readonly score?: number;
  readonly severity: Severity;
}

/**
 * Parse a numeric score or calculate the CVSS v3.0/v3.1 base score from a
 * vector. OSV commonly returns vectors rather than pre-calculated numbers.
 */
export function assessCvss(value: string | undefined): CvssAssessment {
  if (!value) return { severity: 'unknown' };
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 10) {
    return { score: numeric, severity: severityFromScore(numeric) };
  }
  if (!value.startsWith('CVSS:3.')) return { severity: 'unknown' };

  const metrics = new Map<string, string>();
  for (const segment of value.split('/').slice(1)) {
    const separator = segment.indexOf(':');
    if (separator <= 0) continue;
    metrics.set(segment.slice(0, separator), segment.slice(separator + 1));
  }

  const scopeChanged = metrics.get('S') === 'C';
  const attackVector = lookup(metrics.get('AV'), { N: 0.85, A: 0.62, L: 0.55, P: 0.2 });
  const attackComplexity = lookup(metrics.get('AC'), { L: 0.77, H: 0.44 });
  const privilegesRequired = scopeChanged
    ? lookup(metrics.get('PR'), { N: 0.85, L: 0.68, H: 0.5 })
    : lookup(metrics.get('PR'), { N: 0.85, L: 0.62, H: 0.27 });
  const userInteraction = lookup(metrics.get('UI'), { N: 0.85, R: 0.62 });
  const confidentiality = lookup(metrics.get('C'), { H: 0.56, L: 0.22, N: 0 });
  const integrity = lookup(metrics.get('I'), { H: 0.56, L: 0.22, N: 0 });
  const availability = lookup(metrics.get('A'), { H: 0.56, L: 0.22, N: 0 });
  if (
    attackVector === undefined ||
    attackComplexity === undefined ||
    privilegesRequired === undefined ||
    userInteraction === undefined ||
    confidentiality === undefined ||
    integrity === undefined ||
    availability === undefined
  ) {
    return { severity: 'unknown' };
  }

  const exploitability =
    8.22 * attackVector * attackComplexity * privilegesRequired * userInteraction;
  const impactSubScore = 1 - (1 - confidentiality) * (1 - integrity) * (1 - availability);
  const impact = scopeChanged
    ? 7.52 * (impactSubScore - 0.029) - 3.25 * Math.pow(impactSubScore - 0.02, 15)
    : 6.42 * impactSubScore;
  const score =
    impact <= 0
      ? 0
      : roundUp(
          scopeChanged
            ? Math.min(1.08 * (impact + exploitability), 10)
            : Math.min(impact + exploitability, 10),
        );
  return { score, severity: severityFromScore(score) };
}

export function severityFromScore(score: number): Severity {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'unknown';
}

function lookup(
  key: string | undefined,
  values: Readonly<Record<string, number>>,
): number | undefined {
  return key === undefined ? undefined : values[key];
}

function roundUp(value: number): number {
  return Math.ceil((value + Number.EPSILON) * ROUND_UP_MULTIPLIER) / ROUND_UP_MULTIPLIER;
}
