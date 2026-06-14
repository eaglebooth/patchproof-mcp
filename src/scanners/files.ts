/**
 * Bounded repository walker. ResourceGovernor enforces depth,
 * file-count, byte-count, and wall-clock limits.
 */
import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as path from 'node:path';

import { ResourceGovernor } from '../security/resources.js';
import { InvalidInputError, ResourceLimitError } from '../security/errors.js';
import { safeResolve, DEFAULT_IGNORE_DIRS } from '../security/paths.js';
import { systemClock } from '../utils/clock.js';
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
  readonly truncated: boolean;
  readonly truncationReason?: string;
  readonly findings: ReadonlyArray<Finding>;
  readonly ignoreDirs: ReadonlyArray<string>;
}

export const SCAN_IGNORE_DIRS: ReadonlyArray<string> = DEFAULT_IGNORE_DIRS;

const HIDDEN_PREFIX = '.';

/**
 * Walk a repository root, count files and bytes, and emit a typed
 * finding list. The walker uses `ResourceGovernor` to enforce the
 * `maxFiles` / `maxBytes` / `maxDepth` limits, skips the default
 * ignore set, and never follows symlinks unless `followSymlinks`
 * is true. The `findings` array is reserved for the upstream
 * scanners (vulnerabilities, secrets, malformed inputs); this
 * module just produces the typed counts and the walked root.
 */
export async function runRepositoryScan(
  ctx: ToolContext,
  input: RunRepositoryScanInput,
): Promise<RunRepositoryScanOutput> {
  const root = resolveRepoRoot(ctx, input.repoRoot);
  const includeHidden = input.includeHidden ?? false;
  const followSymlinks = input.followSymlinks ?? false;
  const maxFiles = input.maxFiles ?? 50_000;
  const maxBytes = input.maxBytes ?? 524_288_000;
  const maxDepth = input.maxDepth ?? 10;

  const governor = new ResourceGovernor(
    {
      maxFiles,
      maxBytes,
      maxDepth,
      wallClockMs: 60_000,
    },
    () => systemClock.now().getTime(),
  );

  const started = systemClock.now().getTime();
  const stats = await walk(root, 0, {
    root,
    governor,
    includeHidden,
    followSymlinks,
    ignoreDirs: new Set<string>(SCAN_IGNORE_DIRS),
    visitedDirectories: new Set<string>([root]),
  });
  const durationMs = systemClock.now().getTime() - started;

  return {
    repoRoot: root,
    filesScanned: stats.files,
    bytesRead: stats.bytes,
    durationMs,
    truncated: stats.truncated,
    ...(stats.truncationReason ? { truncationReason: stats.truncationReason } : {}),
    findings: [],
    ignoreDirs: SCAN_IGNORE_DIRS,
  };
}

export function resolveRepoRoot(ctx: ToolContext, override: string | undefined): string {
  if (typeof ctx.repoRoot !== 'string' || ctx.repoRoot.length === 0) {
    throw new InvalidInputError('runRepositoryScan: repoRoot is required', { ctx: 'no-root' });
  }
  const candidate = typeof override === 'string' && override.length > 0 ? override : '.';
  return safeResolve(ctx.repoRoot, candidate);
}

interface WalkOptions {
  readonly root: string;
  readonly governor: ResourceGovernor;
  readonly includeHidden: boolean;
  readonly followSymlinks: boolean;
  readonly ignoreDirs: Set<string>;
  readonly visitedDirectories: Set<string>;
}

interface WalkStats {
  files: number;
  bytes: number;
  truncated: boolean;
  truncationReason?: string;
}

async function walk(currentDir: string, depth: number, opts: WalkOptions): Promise<WalkStats> {
  opts.governor.checkDepth(depth);
  opts.governor.checkTime();

  let entries: Dirent[];
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return { files: 0, bytes: 0, truncated: false };
  }

  const stats: WalkStats = { files: 0, bytes: 0, truncated: false };
  for (const entry of entries) {
    try {
      opts.governor.checkTime();
      if (shouldSkipEntry(entry, opts)) continue;
      const childPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walk(childPath, depth + 1, opts);
        mergeStats(stats, sub);
        if (sub.truncated) break;
        continue;
      }
      if (entry.isFile()) {
        opts.governor.checkFile();
        const size = await statFileSize(childPath);
        if (size >= 0) {
          opts.governor.checkBytes(size);
          stats.files += 1;
          stats.bytes += size;
        }
        continue;
      }
      if (entry.isSymbolicLink() && opts.followSymlinks) {
        const real = nodeFs.realpathSync(childPath);
        if (!isInsideRoot(opts.root, real) || opts.visitedDirectories.has(real)) continue;
        opts.visitedDirectories.add(real);
        const sub = await walk(real, depth + 1, opts);
        mergeStats(stats, sub);
        if (sub.truncated) break;
      }
    } catch (error: unknown) {
      if (error instanceof ResourceLimitError) {
        stats.truncated = true;
        stats.truncationReason = error.message;
        break;
      }
      // Ignore unreadable files and symlink targets.
    }
  }
  return stats;
}

function mergeStats(target: WalkStats, source: WalkStats): void {
  target.files += source.files;
  target.bytes += source.bytes;
  if (source.truncated) {
    target.truncated = true;
    if (source.truncationReason) target.truncationReason = source.truncationReason;
  }
}

function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function shouldSkipEntry(entry: Dirent, opts: WalkOptions): boolean {
  if (entry.isDirectory() && opts.ignoreDirs.has(entry.name)) return true;
  if (!opts.includeHidden && entry.name.startsWith(HIDDEN_PREFIX)) return true;
  if (entry.isSymbolicLink() && !opts.followSymlinks) return true;
  return false;
}

async function statFileSize(p: string): Promise<number> {
  try {
    const s = await fs.stat(p);
    return s.isFile() ? s.size : -1;
  } catch {
    return -1;
  }
}
