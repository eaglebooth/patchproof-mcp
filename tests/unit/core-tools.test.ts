import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditDependenciesTool } from '../../src/tools/audit_dependencies.js';
import { generateEvidenceReportTool } from '../../src/tools/generate_evidence_report.js';
import { generateSbomTool } from '../../src/tools/generate_sbom.js';
import { scanRepositoryTool } from '../../src/tools/scan_repository.js';
import type { ToolContext } from '../../src/tools/types.js';

interface ScanResult {
  filesScanned: number;
  bytesRead: number;
  findings: ReadonlyArray<unknown>;
}

interface SbomResult {
  schemaVersion: string;
  components: ReadonlyArray<{ name: string; version: string; purl: string }>;
}

interface AuditResult {
  osvMode: string;
  dependencies: ReadonlyArray<{ name: string; version: string }>;
  vulnerabilities: ReadonlyArray<{ id: string; fixedVersions: ReadonlyArray<string> }>;
}

interface ReportResult {
  format: string;
  report: {
    schemaVersion: string;
    inputs: { config: Record<string, unknown> };
    findings: ReadonlyArray<{ id: string }>;
    remediation: ReadonlyArray<{ package: string; recommendedVersion: string }>;
    limitations: ReadonlyArray<string>;
  };
  html?: string;
}

describe('core MCP tools', () => {
  let repoRoot: string;
  let ctx: ToolContext;

  beforeEach(async () => {
    repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'patchproof-core-'));
    await fs.mkdir(path.join(repoRoot, 'src'));
    await fs.writeFile(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { lodash: '4.17.20' } }),
    );
    await fs.writeFile(
      path.join(repoRoot, 'package-lock.json'),
      JSON.stringify({
        name: 'fixture',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture', version: '1.0.0', dependencies: { lodash: '4.17.20' } },
          'node_modules/lodash': {
            version: '4.17.20',
            resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz',
            integrity: 'sha512-fixture',
          },
        },
      }),
    );
    await fs.writeFile(path.join(repoRoot, 'src', 'index.ts'), "import lodash from 'lodash';\n");
    ctx = { repoRoot, signal: new AbortController().signal };
  });

  afterEach(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  it('scan_repository returns bounded repository statistics', async () => {
    const result = (await scanRepositoryTool.run(ctx, {})) as ScanResult;

    expect(result.filesScanned).toBe(3);
    expect(result.bytesRead).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('generate_sbom emits a deterministic CycloneDX component', async () => {
    const first = (await generateSbomTool.run(ctx, {})) as SbomResult;
    const second = (await generateSbomTool.run(ctx, {})) as SbomResult;

    expect(first.schemaVersion).toBe('1.5');
    expect(first.components).toContainEqual({
      name: 'lodash',
      version: '4.17.20',
      purl: 'pkg:npm/lodash@4.17.20',
      type: 'library',
      licenses: [],
    });
    expect(first).toEqual(second);
  });

  it('audit_dependencies uses the deterministic mock vulnerability table', async () => {
    const result = (await auditDependenciesTool.run(ctx, { osvMode: 'mock' })) as AuditResult;

    expect(result.osvMode).toBe('mock');
    expect(result.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'lodash', version: '4.17.20' })]),
    );
    expect(result.vulnerabilities).toContainEqual(
      expect.objectContaining({
        id: 'GHSA-xxxx-yyyy-zzzz',
        fixedVersions: ['4.17.21'],
      }),
    );
  });

  it('generate_evidence_report returns JSON and self-contained HTML', async () => {
    const result = (await generateEvidenceReportTool.run(ctx, { format: 'both' })) as ReportResult;

    expect(result.format).toBe('both');
    expect(result.report.schemaVersion).toBeTruthy();
    expect(result.report.inputs.config['componentCount']).toBe(1);
    expect(result.report.inputs.config['vulnerabilityCount']).toBe(1);
    expect(result.report.findings).toContainEqual(
      expect.objectContaining({ id: 'lodash@4.17.20:GHSA-xxxx-yyyy-zzzz' }),
    );
    expect(result.report.remediation).toContainEqual(
      expect.objectContaining({ package: 'lodash', recommendedVersion: '4.17.21' }),
    );
    expect(result.report.limitations.length).toBeGreaterThan(0);
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain('PatchProof Evidence Report');
    expect(result.html).toContain('SBOM components');
    expect(result.html).toContain('GHSA-xxxx-yyyy-zzzz');
    expect(result.html).not.toMatch(/<script[^>]+src=/u);
    expect(result.html).not.toMatch(/<link[^>]+href=/u);
  });
});
