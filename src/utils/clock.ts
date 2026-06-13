/**
 * Injectable clock. Tests pass a `Clock` that returns a fixed
 * instant; production code uses the system clock.
 */
export interface Clock {
  now(): Date;
  iso(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  iso: () => new Date().toISOString(),
};

export function fixedClock(iso: string): Clock {
  const d = new Date(iso);
  return {
    now: () => d,
    iso: () => d.toISOString(),
  };
}
