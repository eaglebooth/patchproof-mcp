/**
 * Repository walker + scan orchestrator. Used by the
 * `scan_repository` tool (AC-2) and other tools that need to walk
 * a repository root safely.
 *
 * AC-2 wires this module to the tool; the full implementation
 * (path safety, resource governor, secret scanning, SBOM
 * assembly, OSV lookup) is fleshed out in AC-4..AC-13.
 */
import { InvalidInputError } from '../security/errors.js';
import { safeResolve, DEFAULT_IGNORE_DIRS } from '../security/paths.js';
import type { Finding } from '../types/index.js';
import type { ToolContext } from '../tools/types.js';

export interface RunRepositoryScanInput {
  readonly repoRoot?: string | undefined;
  readonly includeHidden?: boolean | undefined;
  readonly followSymlinks?: boolean | undefined;
  readonly maxFiles?: number | undefined;
  readonly maxBytes?: number | undefined;
  readonly maxDepth?: number | undefined;
}

export interface RunRepositoryScanOutput {
  readonly repoRoot: string;
  readonly filesScanned: number;
  readonly bytesRead: number;
  readonly durationMs: number;
  readonly findings: ReadonlyArray<Finding>;
  readonly ignoreDirs: ReadonlyArray<string>;
}

export const SCAN_IGNORE_DIRS: ReadonlyArray<string> = DEFAULT_IGNORE_DIRS;

/**
 * Walk a repository root, count files and bytes, and emit a typed
 * finding list. The full implementation in later ACs wires in the
 * ResourceGovernor, file walker, secret scanner, and SBOM/parser
 * passes; AC-2's behavior is a typed empty result so the
 * `scan_repository` tool is callable end-to-end.
 */
export async function runRepositoryScan(
  ctx: ToolContext,
  input: RunRepositoryScanInput,
): Promise<RunRepositoryScanOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  const started = Date.now();
  return {
    repoRoot: root,
    filesScanned: 0,
    bytesRead: 0,
    durationMs: Date.now() - started,
    findings: [],
    ignoreDirs: SCAN_IGNORE_DIRS,
  };
}

export function resolveRepoRoot(ctx: ToolContext, override: string | undefined): string {
  const candidate = typeof override === 'string' && override.length > 0 ? override : ctx.repoRoot;
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new InvalidInputError('runRepositoryScan: repoRoot is required', { ctx: 'no-root' });
  }
  return safeResolve(candidate, '.');
}
