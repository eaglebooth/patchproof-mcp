/** Resolve a candidate path and reject lexical escapes from its authorized root. */
import * as path from 'node:path';

import { PathSafetyError } from './errors.js';

export interface SafeResolveOptions {
  readonly allowSymlinks?: boolean;
}

export function safeResolve(
  root: string,
  candidate: string,
  opts: SafeResolveOptions = {},
): string {
  if (typeof root !== 'string' || root.length === 0) {
    throw new PathSafetyError('safeResolve: empty root', { candidate });
  }
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new PathSafetyError('safeResolve: empty candidate', { root });
  }
  if (candidate.includes('\0')) {
    throw new PathSafetyError('safeResolve: null byte in candidate', { candidate });
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  void opts;
  if (!isInside(resolvedRoot, resolved)) {
    throw new PathSafetyError('safeResolve: candidate escapes root', {
      root: resolvedRoot,
      candidate: resolved,
    });
  }
  return resolved;
}

export function isInside(root: string, candidate: string): boolean {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  if (c === r) return true;
  const rel = path.relative(r, c);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export const DEFAULT_IGNORE_DIRS: ReadonlyArray<string> = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.cache',
  'out',
];
