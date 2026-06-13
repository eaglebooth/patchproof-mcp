import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateReport, renderHtml } from '../dist/reporting/generator.js';

const repoRoot = resolve('fixtures/demo-repository');
const outputRoot = resolve('examples');
const context = {
  repoRoot,
  signal: new AbortController().signal,
};
const result = await generateReport(context, { format: 'both' });
const report = {
  ...result.report,
  generatedAt: '2026-06-13T00:00:00.000Z',
  inputs: {
    ...result.report.inputs,
    repoRoot: 'fixtures/demo-repository',
  },
};

await mkdir(outputRoot, { recursive: true });
await writeFile(
  resolve(outputRoot, 'demo-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
await writeFile(resolve(outputRoot, 'demo-report.html'), renderHtml(report));
