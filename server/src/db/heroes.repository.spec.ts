import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { HeroesRepository } from './heroes.repository';
import type { PgService } from './pg.service';

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

function makeRepo(): HeroesRepository {
  const pool = new Pool({});
  const pg = { getPool: () => pool } as unknown as PgService;
  return new HeroesRepository(pg);
}

// An injection-looking value in a string (name) field: if it were concatenated
// into the SQL text it would appear verbatim in the statement. The repository
// must bind it as a `$N` positional parameter instead.
const EVIL_NAME = "'; DROP TABLE heroes; --";

describe('HeroesRepository', () => {
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

  it('getHero: reads via fully parameterized SELECT', async () => {
    const repo = makeRepo();
    await repo.getHero('u1');

    const [sql, params] = hoisted.mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(
      /SELECT name, hero_class, total_xp FROM heroes WHERE user_id = \$1/i,
    );
    expect(params).toEqual(['u1']);
    // The bound value is never interpolated into the SQL text.
    expect(sql).not.toContain('u1');
  });

  it('upsertHero: runs inside runTxn, fully parameterized, injection-safe name', async () => {
    const repo = makeRepo();
    await repo.upsertHero('u1', EVIL_NAME, 'mago', 0);

    // The write must go through runTxn's client, never pool.query directly.
    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const insertCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO heroes/.test(c[0] as string),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/i);
    expect(params).toEqual(['u1', EVIL_NAME, 'mago', 0]);
    // The injection-looking name is bound, never concatenated into SQL text.
    expect(sql).not.toContain(EVIL_NAME);
    expect(sql).not.toContain('u1');
    expect(hoisted.mockRelease).toHaveBeenCalled();
  });

  it('addXp: runs inside runTxn, fully parameterized, clamps via GREATEST', async () => {
    const repo = makeRepo();
    await repo.addXp('u1', -5);

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const updateCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /UPDATE heroes SET total_xp = GREATEST\(0, total_xp \+ \$2\)/.test(
        c[0] as string,
      ),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    expect(params).toEqual(['u1', -5]);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('-5');
  });

  it('deleteHero: runs inside runTxn, fully parameterized', async () => {
    const repo = makeRepo();
    await repo.deleteHero('u1');

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const deleteCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /DELETE FROM heroes WHERE user_id = \$1/.test(c[0] as string),
    );
    expect(deleteCall).toBeDefined();
    const [sql, params] = deleteCall!;
    expect(params).toEqual(['u1']);
    expect(sql).not.toContain('u1');
  });
});
