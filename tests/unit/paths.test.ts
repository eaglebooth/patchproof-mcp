import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isInside, safeResolve, DEFAULT_IGNORE_DIRS } from '../../src/security/paths.js';
import { PathSafetyError } from '../../src/security/errors.js';

describe('safeResolve', () => {
  const root = '/tmp/repo';

  it('resolves a safe candidate', () => {
    expect(safeResolve(root, 'src/index.ts')).toBe(path.resolve(root, 'src/index.ts'));
  });

  it('rejects null bytes', () => {
    expect(() => safeResolve(root, 'src/has\0null.ts')).toThrow(PathSafetyError);
  });

  it('rejects traversal that escapes the root', () => {
    expect(() => safeResolve(root, '../../etc/passwd')).toThrow(PathSafetyError);
  });

  it('isInside is true for the root itself and for nested paths', () => {
    expect(isInside(root, root)).toBe(true);
    expect(isInside(root, '/tmp/repo/src/index.ts')).toBe(true);
  });

  it('isInside is false for paths outside the root', () => {
    expect(isInside(root, '/etc/passwd')).toBe(false);
  });

  it('exposes a stable default ignore-set', () => {
    expect(DEFAULT_IGNORE_DIRS).toContain('node_modules');
    expect(DEFAULT_IGNORE_DIRS).toContain('dist');
    expect(DEFAULT_IGNORE_DIRS).toContain('.git');
  });
});
