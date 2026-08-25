import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { UserDataRepository } from './user-data.repository';
import { ALLOWED_COLLECTIONS } from './users.repository';
import type { PgService } from './pg.service';
import type { Collection } from './users.repository';

const hoisted = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockConnect: vi.fn(),
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock('pg', () => {
  class MockClient {
    query = hoisted.mockClientQuery;
    release = hoisted.mockRelease;
  }
  class MockPool {
    query = hoisted.mockPoolQuery;
    connect = hoisted.mockConnect;
    constructor(public config: unknown) {}
  }
  return { Pool: vi.fn(MockPool) };
});

const mockClient = {
  query: hoisted.mockClientQuery,
  release: hoisted.mockRelease,
};

function makeRepo(): UserDataRepository {
  const pool = new Pool({});
  const pg = { getPool: () => pool } as unknown as PgService;
  return new UserDataRepository(pg);
}

// A value outside the `Collection` union, used to exercise the guard.
const EVIL = 'evil' as unknown as Collection;

describe('UserDataRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockPoolQuery.mockReset();
    hoisted.mockClientQuery.mockReset();
    hoisted.mockRelease.mockReset();
    hoisted.mockConnect.mockReset();
    hoisted.mockConnect.mockResolvedValue(mockClient);
    hoisted.mockClientQuery.mockResolvedValue({ rows: [] });
    hoisted.mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('getCollection: returns payload when found', async () => {
    const payload = { name: 'hero' };
    hoisted.mockPoolQuery.mockResolvedValue({ rows: [{ payload }] });
    const repo = makeRepo();

    const result = await repo.getCollection('u1', 'hero');

    expect(result).toEqual(payload);
    const [sql, params] = hoisted.mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(
      /SELECT payload FROM user_data WHERE user_id = \$1 AND collection = \$2/i,
    );
    expect(params).toEqual(['u1', 'hero']);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('hero');
  });

  it('getCollection: returns null when no row', async () => {
    hoisted.mockPoolQuery.mockResolvedValue({ rows: [] });
    const repo = makeRepo();
    expect(await repo.getCollection('u1', 'hero')).toBeNull();
  });

  it('upsertCollection: runs inside runTxn, returns updated_at, fully parameterized', async () => {
    const updatedAt = new Date('2026-08-21T12:00:00Z');
    // client.query sequence: BEGIN, INSERT, COMMIT.
    hoisted.mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ updated_at: updatedAt }] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = makeRepo();
    const payload = { xp: 10 };

    const result = await repo.upsertCollection('u1', 'hero', payload);

    expect(result).toBe(updatedAt);
    // The write must go through runTxn's client, never pool.query directly.
    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const insertCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO user_data/.test(c[0] as string),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    expect(sql).toMatch(/ON CONFLICT \(user_id, collection\) DO UPDATE/i);
    expect(sql).toMatch(/RETURNING updated_at/i);
    expect(params).toEqual(['u1', 'hero', payload]);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('hero');
    expect(hoisted.mockRelease).toHaveBeenCalledTimes(1);
  });

  it('upsertCollection: LWW — second upsert overwrites payload', async () => {
    const first = new Date('2026-08-21T10:00:00Z');
    const second = new Date('2026-08-21T11:00:00Z');
    hoisted.mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ updated_at: first }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ updated_at: second }] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = makeRepo();

    const r1 = await repo.upsertCollection('u1', 'hero', { v: 1 });
    const r2 = await repo.upsertCollection('u1', 'hero', { v: 2 });

    expect(r1).toBe(first);
    expect(r2).toBe(second);
    const insertCalls = hoisted.mockClientQuery.mock.calls.filter((c) =>
      /INSERT INTO user_data/.test(c[0] as string),
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]).toEqual(['u1', 'hero', { v: 1 }]);
    expect(insertCalls[1][1]).toEqual(['u1', 'hero', { v: 2 }]);
  });

  it('unknown collection: throws before any query (security boundary)', async () => {
    const repo = makeRepo();

    await expect(repo.getCollection('u1', EVIL)).rejects.toThrow(
      /unknown collection/i,
    );
    await expect(repo.upsertCollection('u1', EVIL, {})).rejects.toThrow(
      /unknown collection/i,
    );

    // No DB query/connection issued for the rejected calls.
    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    expect(hoisted.mockConnect).not.toHaveBeenCalled();
  });

  it('ALLOWED_COLLECTIONS contains the expected names', () => {
    expect([...ALLOWED_COLLECTIONS]).toEqual([
      'hero',
      'missions',
      'settings',
      'perfil',
      'mural',
    ]);
  });
});
