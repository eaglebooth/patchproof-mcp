import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateReport, renderHtml } from '../dist/reporting/generator.js';

const outputRoot = resolve('examples');
await mkdir(outputRoot, { recursive: true });

await generateArtifacts('demo-repository', 'fixtures/demo-repository', outputRoot, true);
for (const scenario of ['safe', 'vulnerable', 'dev-transitive', 'malformed', 'missing']) {
  await generateArtifacts(
    scenario,
    `fixtures/scenarios/${scenario}`,
    resolve(outputRoot, 'golden', scenario),
    false,
  );
}

async function generateArtifacts(name, repoPath, destination, writeLegacyNames) {
  const repoRoot = resolve(repoPath);
  const result = await generateReport(
    { repoRoot, signal: new AbortController().signal },
    { format: 'both' },
  );
  const report = {
    ...result.report,
    generatedAt: '2026-06-13T00:00:00.000Z',
    inputs: {
      ...result.report.inputs,
      repoRoot: repoPath,
    },
  };

  await mkdir(destination, { recursive: true });
  const prefix = writeLegacyNames ? 'demo-report' : 'report';
  await writeFile(
    resolve(destination, `${prefix}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(resolve(destination, `${prefix}.html`), renderHtml(report));
  process.stdout.write(`Generated ${name}: ${report.findings.length} findings, risk ${report.riskSummary.highestScore}\n`);
}
