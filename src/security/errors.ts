/**
 * Typed error hierarchy. All errors raised by PatchProof are
 * instances of `PatchProofError`; the surface is small so callers
 * can `instanceof`-discriminate without importing every module.
 *
 * Messages are always run through `redactMessage` at the boundary.
 */

export class PatchProofError extends Error {
  public readonly code: string;
  public readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class PathSafetyError extends PatchProofError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'E_PATH_SAFETY', details);
  }
}

export class ResourceLimitError extends PatchProofError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'E_RESOURCE_LIMIT', details);
  }
}

export class InvalidInputError extends PatchProofError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'E_INVALID_INPUT', details);
  }
}

export class VerificationError extends PatchProofError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'E_VERIFICATION', details);
  }
}

export class OsvError extends PatchProofError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'E_OSV', details);
  }
}

export function isPatchProofError(value: unknown): value is PatchProofError {
  return value instanceof PatchProofError;
}
