import { describe, expect, it } from 'vitest';

import { fingerprint, redactMessage, redactPath } from '../../src/security/redact.js';

describe('redact (scaffold)', () => {
  it('redacts canonical AWS access-key placeholders', () => {
    expect(redactMessage('token=AKIAIOSFODNN7EXAMPLE tail')).toContain('[REDACTED]');
    expect(redactMessage('token=AKIAIOSFODNN7EXAMPLE tail')).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts canonical GitHub PAT placeholders', () => {
    const msg = 'Authorization: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    expect(redactMessage(msg)).not.toContain('ghp_');
  });

  it('leaves innocuous text untouched', () => {
    expect(redactMessage('hello world')).toBe('hello world');
  });

  it('is idempotent', () => {
    const once = redactMessage('AKIAIOSFODNN7EXAMPLE');
    const twice = redactMessage(once);
    expect(twice).toBe(once);
  });

  it('fingerprints are stable for the same input', () => {
    expect(fingerprint('hello')).toBe(fingerprint('hello'));
  });

  it('fingerprints differ for different inputs', () => {
    expect(fingerprint('hello')).not.toBe(fingerprint('world'));
  });

  it('marks non-root paths as outside-root', () => {
    expect(redactPath('/etc/passwd', '/tmp/repo')).toBe('<outside-root>');
    expect(redactPath('/tmp/repo/src/index.ts', '/tmp/repo')).toBe('/tmp/repo/src/index.ts');
  });
});
