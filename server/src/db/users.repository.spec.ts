import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { UsersRepository } from './users.repository';
import type { PgService } from './pg.service';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('pg', () => {
  class MockPool {
    query = mockQuery;
    constructor(public config: unknown) {}
  }
  return { Pool: vi.fn(MockPool) };
});

function makeRepo(): UsersRepository {
  const pool = new Pool({});
  const pg = { getPool: () => pool } as unknown as PgService;
  return new UsersRepository(pg);
}

describe('UsersRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  it('upsertByGoogleSub: issues parameterized INSERT ... ON CONFLICT and returns id', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-uuid' }] });
    const repo = makeRepo();

    const id = await repo.upsertByGoogleSub('sub-1', 'a@b.c', 'Name', 'pic');

    expect(id).toBe('user-uuid');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO users/i);
    expect(sql).toMatch(/ON CONFLICT \(google_sub\)/i);
    expect(sql).toMatch(/RETURNING id/i);
    expect(params).toEqual(['sub-1', 'a@b.c', 'Name', 'pic']);
    // No value interpolation: SQL must not contain the literal values.
    expect(sql).not.toContain('sub-1');
    expect(sql).not.toContain('a@b.c');
  });

  it('findBySub: returns id when found', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-uuid' }] });
    const repo = makeRepo();

    const id = await repo.findBySub('sub-1');

    expect(id).toBe('user-uuid');
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT id FROM users WHERE google_sub = \$1/i);
    expect(params).toEqual(['sub-1']);
    expect(sql).not.toContain('sub-1');
  });

  it('findBySub: returns null when no row', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = makeRepo();
    expect(await repo.findBySub('sub-x')).toBeNull();
  });

  it('saveConsent: issues parameterized UPDATE', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = makeRepo();
    const at = new Date('2026-08-21T00:00:00Z');

    await repo.saveConsent('sub-1', at);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE users SET consent_at = \$2 WHERE google_sub = \$1/i);
    expect(params).toEqual(['sub-1', at]);
    expect(sql).not.toContain('sub-1');
  });
});
