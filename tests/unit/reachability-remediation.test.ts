import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { analyzeReachability } from '../../src/reachability/analyzer.js';
import { planRemediation } from '../../src/remediation/planner.js';
import type { Finding } from '../../src/types/index.js';

const roots: string[] = [];

describe('reachability and remediation', () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('finds static, require, and dynamic imports with file-line evidence', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'patchproof-reachability-'));
    roots.push(root);
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(
      path.join(root, 'src', 'index.ts'),
      [
        "import lodash from 'lodash';",
        "const minimatch = require('minimatch');",
        "void import('@scope/pkg/feature');",
      ].join('\n'),
    );
    const findings = [
      finding('lodash', '4.17.20', 'GHSA-lodash', '4.17.21'),
      finding('minimatch', '3.0.4', 'GHSA-minimatch', '3.1.2'),
      finding('@scope/pkg', '1.0.0', 'GHSA-scope', '2.0.0'),
      finding('unused', '1.0.0', 'GHSA-unused', '1.0.1'),
    ];

    const reachability = await analyzeReachability(root, findings);

    expect(reachability.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ package: 'lodash', classification: 'confirmed' }),
        expect.objectContaining({ package: 'minimatch', classification: 'confirmed' }),
        expect.objectContaining({ package: '@scope/pkg', classification: 'confirmed' }),
      ]),
    );
    expect(reachability.find((result) => result.package === 'unused')?.classification).toBe(
      'unknown',
    );
    expect(reachability[0]?.evidence[0]?.file).toBe('src/index.ts');
    expect(reachability[0]?.evidence[0]?.line).toBeGreaterThan(0);
  });

  it('uses reachability evidence and semantic version distance in remediation', () => {
    const findings = [
      finding('lodash', '4.17.20', 'GHSA-lodash', '4.17.21'),
      finding('@scope/pkg', '1.0.0', 'GHSA-scope', '2.0.0'),
    ];
    const remediation = planRemediation(findings, [
      {
        findingId: findings[0]!.id,
        package: 'lodash',
        classification: 'confirmed',
        evidence: [{ file: 'src/index.ts', line: 1, snippet: "import 'lodash'" }],
      },
    ]);

    expect(remediation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          package: 'lodash',
          breakingChangeRisk: 'low',
          affectedFiles: ['package-lock.json', 'package.json', 'src/index.ts'],
        }),
        expect.objectContaining({ package: '@scope/pkg', breakingChangeRisk: 'high' }),
      ]),
    );
  });
});

function finding(
  packageName: string,
  version: string,
  vulnerabilityId: string,
  fixedVersion: string,
): Finding {
  return {
    id: `${packageName}@${version}:${vulnerabilityId}`,
    kind: 'vulnerability',
    dependency: { name: packageName, version },
    vulnerability: {
      id: vulnerabilityId,
      aliases: [],
      summary: 'fixture',
      severity: 'high',
      fixedVersions: [fixedVersion],
    },
    message: 'fixture',
    severity: 'high',
  };
}
