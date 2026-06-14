import { describe, expect, it } from 'vitest';

import { scoreDependencyRisk, summarizeRisk } from '../../src/risk/scorer.js';
import type { Dependency, OsvVulnerabilitySummary } from '../../src/types/index.js';

const vulnerability: OsvVulnerabilitySummary = {
  id: 'GHSA-test',
  aliases: [],
  summary: 'Test vulnerability',
  severity: 'high',
  cvssScore: 8,
  fixedVersions: ['2.0.0'],
};

function dependency(overrides: Partial<Dependency> = {}): Dependency {
  return {
    name: 'example',
    version: '1.0.0',
    ecosystem: 'npm',
    isDev: false,
    isTransitive: false,
    ...overrides,
  };
}

describe('dependency risk scoring', () => {
  it('scores a direct production dependency deterministically', () => {
    const first = scoreDependencyRisk(dependency(), vulnerability);
    const second = scoreDependencyRisk(dependency(), vulnerability);

    expect(first).toEqual(second);
    expect(first.score).toBe(68);
    expect(first.band).toBe('high');
  });

  it('reduces risk for development dependencies', () => {
    expect(scoreDependencyRisk(dependency({ isDev: true }), vulnerability).score).toBe(44);
  });

  it('reduces risk for transitive dependencies', () => {
    expect(scoreDependencyRisk(dependency({ isTransitive: true }), vulnerability).score).toBe(54);
  });

  it('raises urgency when no fixed version exists', () => {
    const noFix = { ...vulnerability, fixedVersions: [] };
    expect(scoreDependencyRisk(dependency(), noFix).score).toBe(80);
  });

  it('falls back to severity weights when CVSS is absent', () => {
    const { cvssScore: _cvssScore, ...noCvss } = vulnerability;
    expect(scoreDependencyRisk(dependency(), noCvss).score).toBe(68);
  });

  it('summarizes ranked assessments', () => {
    const assessments = [
      scoreDependencyRisk(dependency(), vulnerability),
      scoreDependencyRisk(dependency({ isDev: true }), vulnerability),
    ];
    expect(summarizeRisk(assessments)).toEqual({
      highestScore: 68,
      averageScore: 56,
      counts: { critical: 0, high: 1, medium: 1, low: 0 },
    });
  });
});
