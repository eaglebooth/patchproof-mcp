import { describe, expect, it } from 'vitest';

import { fixedClock, systemClock } from '../../src/utils/clock.js';
import { stableStringify } from '../../src/utils/stable-stringify.js';

describe('utils (scaffold)', () => {
  it('fixedClock returns the same instant on every call', () => {
    const c = fixedClock('2026-01-01T00:00:00.000Z');
    expect(c.iso()).toBe('2026-01-01T00:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('systemClock.iso returns an ISO string', () => {
    expect(systemClock.iso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stableStringify sorts object keys', () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('stableStringify is array-order sensitive', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('stableStringify handles nested objects', () => {
    expect(stableStringify({ a: { c: 3, b: 2 } })).toBe('{"a":{"b":2,"c":3}}');
  });

  it('stableStringify rejects unsupported values', () => {
    expect(() => stableStringify({ a: undefined as unknown as number })).toThrow();
  });
});
