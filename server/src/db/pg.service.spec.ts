import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PgService } from './pg.service';

// Shared mock query fn, hoisted so the pg mock factory can reference it.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('pg', () => {
  class MockPool {
    query = mockQuery;
    constructor(public config: unknown) {}
  }
  // Wrap in vi.fn so the constructor call is spyable (vi.mocked(Pool)).
  return { Pool: vi.fn(MockPool) };
});

const TEST_URL = 'postgresql://user:secret@db.example:26257/agenda?sslmode=verify-full';

describe('PgService', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    delete process.env.DATABASE_URL;
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('(a) success: runs SELECT 1 and logs "db connected"', async () => {
    process.env.DATABASE_URL = TEST_URL;
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const service = new PgService();
    await service.onModuleInit();

    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    expect(logSpy).toHaveBeenCalledWith('db connected');
    // Pool must be configured with the required options.
    expect(vi.mocked(Pool)).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: TEST_URL,
        application_name: 'minha-agenda-backend',
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }),
    );
    // getPool exposes the underlying pool.
    expect(service.getPool()).toBeDefined();
  });

  it('(b) missing DATABASE_URL: constructor throws a clear error', () => {
    delete process.env.DATABASE_URL;
    expect(() => new PgService()).toThrow(/DATABASE_URL/);
    expect(vi.mocked(Pool)).not.toHaveBeenCalled();
  });

  it('(b) empty DATABASE_URL: constructor throws a clear error', () => {
    process.env.DATABASE_URL = '   ';
    expect(() => new PgService()).toThrow(/DATABASE_URL/);
    expect(vi.mocked(Pool)).not.toHaveBeenCalled();
  });

  it('(c) connection error on SELECT 1: onModuleInit throws a clear error', async () => {
    process.env.DATABASE_URL = TEST_URL;
    mockQuery.mockRejectedValue(new Error('connection refused'));

    const service = new PgService();
    await expect(service.onModuleInit()).rejects.toThrow(/connection validation failed/i);
    expect(errorSpy).toHaveBeenCalled();
    // The full DATABASE_URL (with password) must never appear in the error log.
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain(TEST_URL);
  });
});
