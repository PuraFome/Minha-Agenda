import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { runTxn, RETRYABLE_SQLSTATES } from './run-txn';

// Shared mock fns, hoisted so the pg mock factory can reference them.
const hoisted = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock('pg', () => {
  class MockClient {
    query = hoisted.mockQuery;
    release = hoisted.mockRelease;
  }
  class MockPool {
    connect = hoisted.mockConnect;
    constructor(public config: unknown) {}
  }
  return { Pool: vi.fn(MockPool) };
});

// A single shared mock client returned by every pool.connect() call.
const mockClient = {
  query: hoisted.mockQuery,
  release: hoisted.mockRelease,
};

/** Build an Error carrying a pg-style SQLSTATE `code`. */
function sqlError(code: string, message = `sqlstate ${code}`): Error {
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  return err;
}

describe('runTxn', () => {
  let pool: Pool;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockQuery.mockReset();
    hoisted.mockRelease.mockReset();
    hoisted.mockConnect.mockReset();
    // connect() resolves the shared client by default.
    hoisted.mockConnect.mockResolvedValue(mockClient);
    // query() resolves by default (BEGIN / COMMIT / ROLLBACK / fn's queries).
    hoisted.mockQuery.mockResolvedValue({ rows: [] });
    pool = new Pool({});
  });

  it('(a) success path: fn called once, COMMIT once, result returned', async () => {
    const fn = vi.fn(async (client: PoolClient) => {
      await client.query('WORK');
      return 'result-value';
    });

    const result = await runTxn(pool, fn);

    expect(result).toBe('result-value');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(hoisted.mockQuery).toHaveBeenCalledWith('BEGIN');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('COMMIT');
    expect(hoisted.mockQuery).not.toHaveBeenCalledWith('ROLLBACK');
    // Client released exactly once.
    expect(hoisted.mockRelease).toHaveBeenCalledTimes(1);
  });

  it('(b) fn fails first attempt with 40001 then succeeds: fn called twice, COMMIT once', async () => {
    let workCalls = 0;
    hoisted.mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'WORK') {
        workCalls++;
        if (workCalls === 1) {
          throw sqlError('40001');
        }
      }
      return { rows: [] };
    });

    const fn = vi.fn(async (client: PoolClient) => {
      await client.query('WORK');
      return 'ok';
    });

    const result = await runTxn(pool, fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(hoisted.mockQuery).toHaveBeenCalledWith('COMMIT');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(hoisted.mockRelease).toHaveBeenCalledTimes(2);
  });

  it('(c) fn fails all 3 attempts with 40001: throws after exactly 3 attempts', async () => {
    hoisted.mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'WORK') {
        throw sqlError('40001');
      }
      return { rows: [] };
    });

    const fn = vi.fn(async (client: PoolClient) => {
      await client.query('WORK');
      return 'never';
    });

    await expect(runTxn(pool, fn)).rejects.toThrow(/40001/);
    expect(fn).toHaveBeenCalledTimes(3);
    // COMMIT must never succeed; ROLLBACK happens on each failed attempt.
    expect(hoisted.mockQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(hoisted.mockQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(hoisted.mockRelease).toHaveBeenCalledTimes(3);
  });

  it('(d) non-retryable code 23505: throws immediately, fn called exactly once', async () => {
    hoisted.mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'WORK') {
        throw sqlError('23505');
      }
      return { rows: [] };
    });

    const fn = vi.fn(async (client: PoolClient) => {
      await client.query('WORK');
      return 'never';
    });

    await expect(runTxn(pool, fn)).rejects.toThrow(/23505/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(hoisted.mockQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(hoisted.mockRelease).toHaveBeenCalledTimes(1);
  });

  it.each([...RETRYABLE_SQLSTATES])(
    '(e) retryable code %s triggers a retry',
    async (code) => {
      let workCalls = 0;
      hoisted.mockQuery.mockImplementation(async (sql: string) => {
        if (sql === 'WORK') {
          workCalls++;
          if (workCalls === 1) {
            throw sqlError(code);
          }
        }
        return { rows: [] };
      });

      const fn = vi.fn(async (client: PoolClient) => {
        await client.query('WORK');
        return 'ok';
      });

      const result = await runTxn(pool, fn);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(hoisted.mockRelease).toHaveBeenCalledTimes(2);
    },
  );
});
