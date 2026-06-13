/**
 * Resource governor. The full implementation lands in AC-13; the
 * scaffold exposes the constructor and the same public surface so
 * later ACs can import it without changes.
 */
import { ResourceLimitError } from './errors.js';

export interface ResourceLimits {
  readonly maxFiles: number;
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly wallClockMs: number;
}

export interface ResourceState {
  readonly files: number;
  readonly bytes: number;
  readonly depth: number;
  readonly startedAt: number;
}

export class ResourceGovernor {
  private files = 0;
  private bytes = 0;
  private readonly startedAt: number;

  constructor(
    public readonly limits: ResourceLimits,
    readonly clock: () => number = Date.now,
  ) {
    this.startedAt = clock();
  }

  reset(): void {
    this.files = 0;
    this.bytes = 0;
  }

  checkFile(): void {
    this.files += 1;
    if (this.files > this.limits.maxFiles) {
      throw new ResourceLimitError('file count exceeded', {
        limit: this.limits.maxFiles,
        seen: this.files,
      });
    }
  }

  checkBytes(delta: number): void {
    if (delta < 0) return;
    this.bytes += delta;
    if (this.bytes > this.limits.maxBytes) {
      throw new ResourceLimitError('byte count exceeded', {
        limit: this.limits.maxBytes,
        seen: this.bytes,
      });
    }
  }

  checkDepth(depth: number): void {
    if (depth > this.limits.maxDepth) {
      throw new ResourceLimitError('recursion depth exceeded', {
        limit: this.limits.maxDepth,
        seen: depth,
      });
    }
  }

  checkTime(): void {
    const elapsed = this.clock() - this.startedAt;
    if (elapsed > this.limits.wallClockMs) {
      throw new ResourceLimitError('wall-clock exceeded', {
        limitMs: this.limits.wallClockMs,
        elapsedMs: elapsed,
      });
    }
  }

  snapshot(): ResourceState {
    return { files: this.files, bytes: this.bytes, depth: 0, startedAt: this.startedAt };
  }
}
