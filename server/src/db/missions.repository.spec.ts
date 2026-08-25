import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { MissionsRepository, Mission } from './missions.repository';
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

function makeRepo(): MissionsRepository {
  const pool = new Pool({});
  const pg = { getPool: () => pool } as unknown as PgService;
  return new MissionsRepository(pg);
}

// An injection-looking value in a string (title) field: if concatenated into the
// SQL text it would appear verbatim. The repository must bind it as a `$N` param.
const EVIL_TITLE = "'; DROP TABLE missions; --";

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'T',
    difficulty: 'facil',
    dueDate: null,
    completed: false,
    completedAt: null,
    ...overrides,
  };
}

describe('MissionsRepository', () => {
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

  it('listMissions: reads via fully parameterized SELECT', async () => {
    const repo = makeRepo();
    await repo.listMissions('u1');

    const [sql, params] = hoisted.mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(
      /FROM missions WHERE user_id = \$1 ORDER BY created_at ASC/i,
    );
    expect(params).toEqual(['u1']);
    expect(sql).not.toContain('u1');
  });

  it('getMission: reads via fully parameterized SELECT with id', async () => {
    const repo = makeRepo();
    await repo.getMission('u1', 'm1');

    const [sql, params] = hoisted.mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/FROM missions WHERE user_id = \$1 AND id = \$2/i);
    expect(params).toEqual(['u1', 'm1']);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('m1');
  });

  it('listMissions: normalizes DATE/TIMESTAMPTZ driver Date objects to string contract', async () => {
    // CockroachDB returns DATE as a JS Date (midnight UTC) and TIMESTAMPTZ as a
    // JS Date. The mapping layer must emit 'YYYY-MM-DD' for dueDate and an ISO
    // string for completedAt.
    const due = new Date('2026-08-25T00:00:00.000Z');
    const completed = new Date('2026-08-25T18:39:37.191Z');
    hoisted.mockPoolQuery.mockResolvedValue({
      rows: [
        {
          id: 'm1',
          user_id: 'u1',
          title: 'T',
          difficulty: 'facil',
          due_date: due,
          completed: true,
          completed_at: completed,
        },
      ],
    });
    const repo = makeRepo();
    const missions = await repo.listMissions('u1');

    expect(missions).toEqual([
      {
        id: 'm1',
        title: 'T',
        difficulty: 'facil',
        dueDate: '2026-08-25',
        completed: true,
        completedAt: '2026-08-25T18:39:37.191Z',
      },
    ]);
    expect(typeof missions[0].dueDate).toBe('string');
    expect(typeof missions[0].completedAt).toBe('string');
  });

  it('listMissions: keeps null dueDate/completedAt as null', async () => {
    hoisted.mockPoolQuery.mockResolvedValue({
      rows: [
        {
          id: 'm1',
          user_id: 'u1',
          title: 'T',
          difficulty: 'facil',
          due_date: null,
          completed: false,
          completed_at: null,
        },
      ],
    });
    const repo = makeRepo();
    const missions = await repo.listMissions('u1');

    expect(missions[0].dueDate).toBeNull();
    expect(missions[0].completedAt).toBeNull();
  });

  it('listMissions: accepts already-string date values (no double conversion)', async () => {
    // A cast in SQL can yield a string; the mapper must still normalize it.
    hoisted.mockPoolQuery.mockResolvedValue({
      rows: [
        {
          id: 'm1',
          user_id: 'u1',
          title: 'T',
          difficulty: 'facil',
          due_date: '2026-08-25',
          completed: true,
          completed_at: '2026-08-25T18:39:37.191Z',
        },
      ],
    });
    const repo = makeRepo();
    const missions = await repo.listMissions('u1');

    expect(missions[0].dueDate).toBe('2026-08-25');
    expect(missions[0].completedAt).toBe('2026-08-25T18:39:37.191Z');
  });

  it('createMission: runs inside runTxn, fully parameterized, injection-safe title', async () => {
    const repo = makeRepo();
    const mission = makeMission({ title: EVIL_TITLE });
    await repo.createMission('u1', mission);

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const insertCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO missions/.test(c[0] as string),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    expect(sql).toMatch(/INSERT INTO missions/i);
    expect(params).toEqual([
      mission.id,
      'u1',
      EVIL_TITLE,
      'facil',
      null,
      false,
      null,
    ]);
    // The injection-looking title is bound, never concatenated into SQL text.
    expect(sql).not.toContain(EVIL_TITLE);
    expect(sql).not.toContain('u1');
    expect(hoisted.mockRelease).toHaveBeenCalled();
  });

  it('updateMission: dynamic SET list is fully parameterized, injection-safe title', async () => {
    const repo = makeRepo();
    await repo.updateMission('u1', 'm1', { title: EVIL_TITLE, difficulty: 'epica' });

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const updateCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /UPDATE missions SET /.test(c[0] as string),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    // Column names are literals authored in the repo; the SET list is composed
    // with string concatenation (not template interpolation) of caller values.
    expect(sql).toMatch(/title = \$3/);
    expect(sql).toMatch(/difficulty = \$4/);
    expect(sql).toMatch(/WHERE user_id = \$1 AND id = \$2/);
    expect(params).toEqual(['u1', 'm1', EVIL_TITLE, 'epica']);
    expect(sql).not.toContain(EVIL_TITLE);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('m1');
  });

  it('setCompleted: runs inside runTxn, fully parameterized', async () => {
    const repo = makeRepo();
    await repo.setCompleted('u1', 'm1', '2026-08-21T12:00:00Z');

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const updateCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /SET completed = \$3, completed_at = \$4::timestamptz/.test(c[0] as string),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    expect(params).toEqual(['u1', 'm1', true, '2026-08-21T12:00:00Z']);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('m1');
  });

  it('deleteMission: runs inside runTxn, fully parameterized', async () => {
    const repo = makeRepo();
    await repo.deleteMission('u1', 'm1');

    expect(hoisted.mockPoolQuery).not.toHaveBeenCalled();
    const deleteCall = hoisted.mockClientQuery.mock.calls.find((c) =>
      /DELETE FROM missions WHERE user_id = \$1 AND id = \$2/.test(c[0] as string),
    );
    expect(deleteCall).toBeDefined();
    const [sql, params] = deleteCall!;
    expect(params).toEqual(['u1', 'm1']);
    expect(sql).not.toContain('u1');
    expect(sql).not.toContain('m1');
  });
});
