import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { UserSettingsRepository } from './user-settings.repository';
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

function makeRepo(): UserSettingsRepository {
  const pool = new Pool({});
  const pg = { getPool: () => pool } as unknown as PgService;
  return new UserSettingsRepository(pg);
}

// An injection-looking value in a string (user_id) field: if concatenated into
// the SQL text it would appear verbatim. The repository must bind it as a `$N`
// positional parameter instead.
const EVIL_USER = "'; DROP TABLE user_settings; --";

describe('UserSettingsRepository', () => {
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

  it('getSettings: reads via fully parameterized SELECT', async () => {
    const repo = makeRepo();
    await repo.getSettings('u1');

    const [sql, params] = hoisted.mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(
      /SELECT retention_days, mural_active_tab FROM user_settings WHERE user_id = \$1/i,
    );
    expect(params).toEqual(['u1']);
    // The bound value is never interpolated into the SQL text.
    expect(sql).not.toContain('u1');
  });

  it('getSettings: coerces INT8 retention_days (string from driver) to a strict number', async () => {
    // CockroachDB returns INT8 via node-pg as a JS string; the mapping layer
    // must coerce it to a number for the documented `retentionDays: number`.
    hoisted.mockPoolQuery.mockResolvedValue({
      rows: [{ retention_days: '30', mural_active_tab: 'pending' }],
    });
    const repo = makeRepo();
    const settings = await repo.getSettings('u1');

    expect(settings).toEqual({ retentionDays: 30, muralActiveTab: 'pending' });
    expect(typeof settings!.retentionDays).toBe('number');
    expect(settings!.retentionDays).toBe(30);
  });

  it('getSettings: returns null when no row exists', async () => {
    hoisted.mockPoolQuery.mockResolvedValue({ rows: [] });
    const repo = makeRepo();
    expect(await repo.getSettings('u1')).toBeNull();
  });

  it('upsertSettings: runs inside runTxn, fully parameterized, injection-safe user_id', async () => {
    const repo = makeRepo();
    await repo.upsertSettings(EVIL_USER, 7, 'pending');

    // The write must go through runTxn's client, never pool.query directly.
    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const insertCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO user_settings/.test(c[0] as string),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/i);
    expect(params).toEqual([EVIL_USER, 7, 'pending']);
    // The injection-looking user_id is bound, never concatenated into SQL text.
    expect(sql).not.toContain(EVIL_USER);
    expect(hoisted.mockRelease).toHaveBeenCalled();
  });
});
