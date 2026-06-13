/**
 * CycloneDX SBOM assembly. Used by the `generate_sbom` tool
 * (AC-2) and the `generate_evidence_report` tool (AC-11).
 *
 * AC-2 wires the tool to this module's public function; the full
 * implementation (lockfile parsing → component list → CycloneDX
 * JSON validated against the official schema) lands in AC-5.
 */
import { resolveRepoRoot, type RunRepositoryScanInput } from '../scanners/files.js';
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

export async function buildCycloneDxSbom(
  ctx: ToolContext,
  input: BuildSbomInput,
): Promise<BuildSbomOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  return {
    repoRoot: root,
    format: 'cyclonedx',
    schemaVersion: CYCLONEDX_VERSION,
    serialNumber: `urn:uuid:${placeholderSerial()}`,
    components: [],
  };
}

function placeholderSerial(): string {
  // Deterministic placeholder; the real implementation computes a
  // content-addressed serial in AC-5.
  return '00000000-0000-4000-8000-000000000000';
}
