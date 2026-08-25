import { Pool } from 'pg';
import type { PoolClient } from 'pg';

/**
 * SQLSTATE codes that CockroachDB (and PostgreSQL) signal as transient and safe
 * to retry by re-running the whole transaction. Kept as a Set so it is obvious
 * and easy to extend.
 *
 *  - 40001  serialization_failure
 *  - 40P01  deadlock_detected
 *  - 57P01  admin_shutdown
 *  - 57P02  crash_shutdown
 *  - 57P03  cannot_connect_now
 */
export const RETRYABLE_SQLSTATES = new Set<string>([
  '40001',
  '40P01',
  '57P01',
  '57P02',
  '57P03',
]);

/** Maximum number of total attempts (initial try + retries). */
export const MAX_ATTEMPTS = 3;

/** Base delay (ms) for exponential backoff: 10, 20, 40, ... */
export const BACKOFF_BASE_MS = 10;

/**
 * Run `fn(client)` inside a `BEGIN`/`COMMIT` transaction on a client borrowed
 * from `pool`. On a retryable SQLSTATE (`RETRYABLE_SQLSTATES`) the whole
 * transaction is retried with exponential backoff, up to `MAX_ATTEMPTS` total
 * attempts. Any other error (or exhausted retries) is rethrown immediately.
 *
 * The client is always released in a `finally`, so clients are never leaked.
 */
export async function runTxn<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      // Roll back the failed transaction; never let a rollback error mask the
      // original error (or block a retry).
      try {
        await client.query('ROLLBACK');
      } catch {
        // swallow rollback errors
      }

      const code = (err as { code?: string } | null)?.code;
      const retryable = code !== undefined && RETRYABLE_SQLSTATES.has(code);

      if (retryable && attempt < MAX_ATTEMPTS) {
        const delay = BACKOFF_BASE_MS * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    } finally {
      client.release();
    }
  }
}
