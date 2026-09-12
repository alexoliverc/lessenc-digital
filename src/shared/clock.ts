export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

// Immutable UTC representation; prevents Date.setTime from rewriting a snapshot.
export function utcNow(clock: Clock): string {
  return clock.now().toISOString();
}

export function isUtcInstant(value: string | null): value is string {
  if (value === null) return false;

  const parsed = new Date(value);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
