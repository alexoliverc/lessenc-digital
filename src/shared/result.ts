import { ApplicationError } from "./application-error";

export type Result<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: ApplicationError }>;

export function attempt<T>(operation: () => T): Result<T> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    if (error instanceof ApplicationError) return { ok: false, error };
    throw error;
  }
}

export async function attemptAsync<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof ApplicationError) return { ok: false, error };
    throw error;
  }
}
