import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock fns, hoisted so the pg / fs mock factories can reference them.
const hoisted = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnd: vi.fn().mockResolvedValue(undefined),
  mockExistsSync: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: hoisted.mockExistsSync,
}));

vi.mock('fs/promises', () => ({
  readFile: hoisted.mockReadFile,
}));

vi.mock('pg', () => {
  class MockPool {
    query = hoisted.mockQuery;
    end = hoisted.mockEnd;
    constructor(public config: unknown) {}
  }
  // Wrap in vi.fn so the constructor call is spyable (vi.mocked(Pool)).
  return { Pool: vi.fn(MockPool) };
});

import { main, resolveSchemaPath, splitSql } from './migrate';

const TEST_URL =
  'postgresql://user:secret@db.example:26257/agenda?sslmode=verify-full';

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS user_data (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  collection text NOT NULL
);
`;

describe('migrate', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockQuery.mockReset();
    hoisted.mockEnd.mockResolvedValue(undefined);
    hoisted.mockExistsSync.mockReset();
    hoisted.mockReadFile.mockReset();
    delete process.env.DATABASE_URL;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Make process.exit throw so the test can observe the non-zero exit path
    // without actually terminating the runner.
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(
        (() => {
          throw new Error('process.exit called');
        }) as unknown as (
          code?: string | number | null | undefined,
        ) => never,
      );
  });

  it('splitSql splits on ";" and drops empty trailing statements', () => {
    const stmts = splitSql(SCHEMA);
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toContain('CREATE EXTENSION');
    expect(stmts[1]).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(stmts[2]).toContain('CREATE TABLE IF NOT EXISTS user_data');
  });

  it('(a)+(b) reads schema.sql and executes each DDL statement via pool.query', async () => {
    process.env.DATABASE_URL = TEST_URL;
    hoisted.mockExistsSync.mockReturnValue(true);
    hoisted.mockReadFile.mockResolvedValue(SCHEMA);

    await main();

    // (a) schema.sql was read from the filesystem.
    expect(hoisted.mockReadFile).toHaveBeenCalledTimes(1);
    const readArg = hoisted.mockReadFile.mock.calls[0][0] as string;
    expect(readArg).toMatch(/schema\.sql$/);

    // (b) each DDL statement executed exactly once, in order.
    expect(hoisted.mockQuery).toHaveBeenCalledTimes(3);
    const executed = hoisted.mockQuery.mock.calls.map((c) => c[0] as string);
    expect(executed[0]).toContain('CREATE EXTENSION');
    expect(executed[1]).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(executed[2]).toContain('CREATE TABLE IF NOT EXISTS user_data');

    // The pool was created and closed.
    expect(hoisted.mockEnd).toHaveBeenCalledTimes(1);

    // DATABASE_URL password must never appear in logs.
    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain(TEST_URL);
  });

  it('(c) missing DATABASE_URL: logs clear error and exits non-zero', async () => {
    delete process.env.DATABASE_URL;
    await expect(main()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL'),
    );
    // No DB work should have started.
    expect(hoisted.mockReadFile).not.toHaveBeenCalled();
    expect(hoisted.mockQuery).not.toHaveBeenCalled();
  });

  it('(c) empty DATABASE_URL: logs clear error and exits non-zero', async () => {
    process.env.DATABASE_URL = '   ';
    await expect(main()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL'),
    );
  });

  it('resolveSchemaPath finds schema.sql when existsSync reports it', () => {
    hoisted.mockExistsSync.mockReturnValue(true);
    const resolved = resolveSchemaPath();
    expect(resolved).toMatch(/schema\.sql$/);
  });
});
