import { describe, expect, it } from 'vitest';

import {
  InvalidInputError,
  isPatchProofError,
  OsvError,
  PatchProofError,
  PathSafetyError,
  ResourceLimitError,
  VerificationError,
} from '../../src/security/errors.js';

describe('typed errors', () => {
  it.each([
    [new PathSafetyError('path'), 'E_PATH_SAFETY'],
    [new ResourceLimitError('limit'), 'E_RESOURCE_LIMIT'],
    [new InvalidInputError('input'), 'E_INVALID_INPUT'],
    [new VerificationError('verify'), 'E_VERIFICATION'],
    [new OsvError('osv'), 'E_OSV'],
  ])('assigns stable codes', (error, code) => {
    expect(error.code).toBe(code);
    expect(error.name).toBe(error.constructor.name);
    expect(isPatchProofError(error)).toBe(true);
  });

  it('rejects unrelated errors and retains details', () => {
    const error = new PatchProofError('message', 'E_TEST', { field: 'value' });
    expect(error.details).toEqual({ field: 'value' });
    expect(isPatchProofError(new Error('other'))).toBe(false);
  });
});
