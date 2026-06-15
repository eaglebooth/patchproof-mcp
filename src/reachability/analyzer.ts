import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { DEFAULT_IGNORE_DIRS } from '../security/paths.js';
import type { Finding, ReachabilityResult } from '../types/index.js';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const MAX_SOURCE_FILES = 2_000;
const MAX_SOURCE_BYTES = 2 * 1_024 * 1_024;

export async function analyzeReachability(
  repoRoot: string,
  findings: ReadonlyArray<Finding>,
): Promise<ReadonlyArray<ReachabilityResult>> {
  const vulnerable = findings.filter(
    (finding) => finding.kind === 'vulnerability' && finding.dependency !== undefined,
  );
  if (vulnerable.length === 0) return [];

  const sourceFiles = await collectSourceFiles(repoRoot);
  const imports = await collectImports(repoRoot, sourceFiles);
  return vulnerable.map((finding) => {
    const packageName = finding.dependency?.name ?? '';
    const exactEvidence = imports.filter((candidate) =>
      isPackageImport(candidate.specifier, packageName),
    );
    const possibleEvidence =
      exactEvidence.length > 0
        ? []
        : imports.filter((candidate) => candidate.lineText.includes(packageName));
    const selected = exactEvidence.length > 0 ? exactEvidence : possibleEvidence;
    return {
      findingId: finding.id,
      package: packageName,
      classification:
        exactEvidence.length > 0
          ? 'confirmed'
          : possibleEvidence.length > 0
            ? 'possible'
            : 'unknown',
      evidence: selected.slice(0, 10).map((candidate) => ({
        file: candidate.file,
        line: candidate.line,
        snippet: candidate.lineText.slice(0, 240),
      })),
    };
  });
}

interface ImportEvidence {
  readonly file: string;
  readonly line: number;
  readonly lineText: string;
  readonly specifier: string;
}

async function collectSourceFiles(repoRoot: string): Promise<ReadonlyArray<string>> {
  const files: string[] = [];
  const ignore = new Set(DEFAULT_IGNORE_DIRS);

  async function walk(directory: string): Promise<void> {
    if (files.length >= MAX_SOURCE_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_SOURCE_FILES) break;
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) await walk(absolute);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(absolute);
      }
    }
  }

  await walk(repoRoot);
  return files.sort();
}

async function collectImports(
  repoRoot: string,
  files: ReadonlyArray<string>,
): Promise<ReadonlyArray<ImportEvidence>> {
  const evidence: ImportEvidence[] = [];
  for (const absolute of files) {
    let stat;
    try {
      stat = await fs.stat(absolute);
    } catch {
      continue;
    }
    if (stat.size > MAX_SOURCE_BYTES) continue;
    let text: string;
    try {
      text = await fs.readFile(absolute, 'utf8');
    } catch {
      continue;
    }
    const relative = path.relative(repoRoot, absolute).split(path.sep).join('/');
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index++) {
      const lineText = lines[index]?.trim() ?? '';
      if (lineText.startsWith('//')) continue;
      for (const specifier of extractSpecifiers(lineText)) {
        evidence.push({ file: relative, line: index + 1, lineText, specifier });
      }
    }
  }
  return evidence;
}

function extractSpecifiers(line: string): ReadonlyArray<string> {
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.push(specifier);
    }
  }
  return specifiers;
}

function isPackageImport(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}
