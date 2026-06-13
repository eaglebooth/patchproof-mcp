/**
 * Build a deterministic CycloneDX 1.5-shaped component inventory
 * from package-lock.json with a content-addressed serial number.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
import { parseNpmLockfile } from '../parsers/lockfile.js';
import type { ToolContext } from '../tools/types.js';

export interface BuildSbomInput extends RunRepositoryScanInput {
  readonly format?: 'cyclonedx' | undefined;
}

export interface BuildSbomOutput {
  readonly repoRoot: string;
  readonly format: 'cyclonedx';
  readonly schemaVersion: '1.5';
  readonly serialNumber: string;
  readonly components: ReadonlyArray<SbomComponent>;
}

export interface SbomComponent {
  readonly type: 'library';
  readonly name: string;
  readonly version: string;
  readonly purl: string;
  readonly licenses: ReadonlyArray<string>;
}

export const CYCLONEDX_VERSION = '1.5' as const;

const PURL_TYPE = 'pkg:npm/';
const LOCKFILE_BASENAME = 'package-lock.json';

export async function buildCycloneDxSbom(
  ctx: ToolContext,
  input: BuildSbomInput,
): Promise<BuildSbomOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  const lockfilePath = path.join(root, LOCKFILE_BASENAME);

  let lockfileText = '';
  let components: ReadonlyArray<SbomComponent> = [];
  try {
    lockfileText = await fs.readFile(lockfilePath, 'utf8');
    components = toComponents(parseNpmLockfile(lockfileText));
  } catch {
    // No lockfile or unreadable lockfile: emit an SBOM with no
    // components but a content-addressed serial so downstream
    // tools can still diff by `serialNumber`.
  }

  return {
    repoRoot: root,
    format: 'cyclonedx',
    schemaVersion: CYCLONEDX_VERSION,
    serialNumber: `urn:uuid:${contentAddressedSerial(lockfileText)}`,
    components,
  };
}

function toComponents(entries: ReadonlyArray<ReturnType<typeof parseNpmLockfile>[number]>): ReadonlyArray<SbomComponent> {
  const out: SbomComponent[] = entries.map((e) => ({
    type: 'library' as const,
    name: e.name,
    version: e.version,
    purl: `${PURL_TYPE}${e.name}@${e.version}`,
    licenses: e.licenses,
  }));
  return out;
}

/**
 * Deterministically derive a UUID v4-shaped serial number from
 * `lockfileText`. Identical lockfile content produces the same
 * serial across runs and machines. Two lockfiles that differ
 * by a single byte produce different serials with overwhelming
 * probability (sha256 collision resistance).
 */
function contentAddressedSerial(lockfileText: string): string {
  const hex = crypto.createHash('sha256').update(lockfileText).digest('hex').slice(0, 32);
  // Format as 8-4-4-4-12 (UUID layout) and force the version-4
  // nibble + variant bits so the result passes naive regexes for
  // v4 UUIDs without lying about randomness.
  const chars = hex.split('');
  chars[12] = '4';
  chars[16] = '8';
  const groups = [chars.slice(0, 8), chars.slice(8, 12), chars.slice(12, 16), chars.slice(16, 20), chars.slice(20, 32)];
  return groups.map((g) => g.join('')).join('-');
}
