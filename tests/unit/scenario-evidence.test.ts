import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateReport } from '../../src/reporting/generator.js';

const scenarios = [
  { name: 'safe', findings: 0, risk: 0 },
  { name: 'vulnerable', findings: 2, risk: 61 },
  { name: 'dev-transitive', findings: 1, risk: 23 },
  { name: 'malformed', findings: 0, risk: 0 },
  { name: 'missing', findings: 0, risk: 0 },
] as const;

describe('scenario evidence', () => {
  for (const scenario of scenarios) {
    it(`generates expected evidence for ${scenario.name}`, async () => {
      const repoRoot = path.resolve('fixtures', 'scenarios', scenario.name);
      const result = await generateReport(
        { repoRoot, signal: new AbortController().signal },
        { format: 'both' },
      );

      expect(result.report.findings).toHaveLength(scenario.findings);
      expect(result.report.riskSummary.highestScore).toBe(scenario.risk);
      expect(result.html).toContain('PatchProof Evidence Report');
    });
  }

  it('ranks vulnerable findings by descending risk', async () => {
    const repoRoot = path.resolve('fixtures', 'scenarios', 'vulnerable');
    const result = await generateReport(
      { repoRoot, signal: new AbortController().signal },
      { format: 'json' },
    );
    const scores = result.report.findings.map((finding) => finding.risk?.score ?? 0);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
