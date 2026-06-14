import { describe, expect, it } from 'vitest';

import { ResourceGovernor } from '../../src/security/resources.js';
import { ResourceLimitError } from '../../src/security/errors.js';

describe('ResourceGovernor', () => {
  it('enforces a file-count cap', () => {
    const g = new ResourceGovernor(
      { maxFiles: 2, maxBytes: 1024, maxDepth: 1, wallClockMs: 1_000 },
      () => 0,
    );
    g.checkFile();
    g.checkFile();
    expect(() => g.checkFile()).toThrow(ResourceLimitError);
  });

  it('enforces a byte-count cap', () => {
    const g = new ResourceGovernor(
      { maxFiles: 10, maxBytes: 5, maxDepth: 1, wallClockMs: 1_000 },
      () => 0,
    );
    g.checkBytes(3);
    g.checkBytes(2);
    expect(() => g.checkBytes(1)).toThrow(ResourceLimitError);
  });

  it('enforces a recursion-depth cap', () => {
    const g = new ResourceGovernor(
      { maxFiles: 10, maxBytes: 1024, maxDepth: 2, wallClockMs: 1_000 },
      () => 0,
    );
    expect(() => g.checkDepth(3)).toThrow(ResourceLimitError);
  });

  it('enforces a wall-clock cap', () => {
    let now = 0;
    const g = new ResourceGovernor(
      { maxFiles: 10, maxBytes: 1024, maxDepth: 1, wallClockMs: 100 },
      () => now,
    );
    now = 200;
    expect(() => g.checkTime()).toThrow(ResourceLimitError);
  });

  it('ignores negative byte deltas and exposes snapshots', () => {
    const g = new ResourceGovernor(
      { maxFiles: 10, maxBytes: 10, maxDepth: 2, wallClockMs: 1_000 },
      () => 42,
    );
    g.checkFile();
    g.checkBytes(-1);
    g.checkBytes(4);
    expect(g.snapshot()).toEqual({ files: 1, bytes: 4, depth: 0, startedAt: 42 });
  });

  it('resets accumulated file and byte counts', () => {
    const g = new ResourceGovernor(
      { maxFiles: 10, maxBytes: 10, maxDepth: 2, wallClockMs: 1_000 },
      () => 0,
    );
    g.checkFile();
    g.checkBytes(4);
    g.reset();
    expect(g.snapshot()).toEqual({ files: 0, bytes: 0, depth: 0, startedAt: 0 });
  });
});
