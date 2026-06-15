import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('returns sensible defaults when env is empty', () => {
    const c = loadConfig({}, []);
    expect(c.transport).toBe('stdio');
    expect(c.osvMode).toBe('mock');
    expect(c.httpPort).toBe(8765);
    expect(c.httpPublic).toBe(false);
    expect(c.maxFiles).toBe(50000);
    expect(c.maxBytes).toBe(524288000);
    expect(c.maxDepth).toBe(10);
    expect(c.scanTimeoutMs).toBe(60000);
    expect(c.verifyTimeoutMs).toBe(120000);
  });

  it('parses PATCHPROOF_TRANSPORT=http from env', () => {
    const c = loadConfig({ PATCHPROOF_TRANSPORT: 'http' }, []);
    expect(c.transport).toBe('http');
  });

  it('accepts the implemented live OSV mode', () => {
    expect(loadConfig({ PATCHPROOF_OSV_MODE: 'live' }, []).osvMode).toBe('live');
  });

  it('rejects an invalid transport', () => {
    expect(() => loadConfig({ PATCHPROOF_TRANSPORT: 'foo' }, [])).toThrow();
  });

  it('honors --transport=stdio and --port=9123 from argv', () => {
    const c = loadConfig({}, ['node', 'patchproof', '--transport', 'stdio', '--port', '9123']);
    expect(c.httpPort).toBe(9123);
  });

  it('rejects negative ports', () => {
    expect(() => loadConfig({ PATCHPROOF_HTTP_PORT: '-1' }, [])).toThrow();
  });
});
