import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { MissionsModule } from './missions.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { AuthTokensRepository } from '../db/auth-tokens.repository';
import {
  MissionsRepository,
  Mission,
} from '../db/missions.repository';

const UUID = '11111111-1111-1111-1111-111111111111';
const BEARER = { Authorization: 'Bearer ma_test-token' };

const tokensRepo: Partial<AuthTokensRepository> = {
  findUserByToken: async (token: string) =>
    token === 'ma_test-token'
      ? { sub: 'sub-1', email: 'a@b.c', name: 'Name', picture: 'pic' }
      : null,
};

// In-memory MissionsRepository stub mirroring the real repository's behavior
// (create stores the mission, setCompleted toggles completed + completedAt,
// updateMission applies the patch, getMission returns the stored row).
const missionStore = new Map<string, Mission>();
const missionsRepo: Partial<MissionsRepository> = {
  listMissions: async (): Promise<Mission[]> => [...missionStore.values()],
  createMission: async (_userId: string, mission: Mission): Promise<void> => {
    missionStore.set(mission.id, { ...mission });
  },
  getMission: async (_userId: string, id: string): Promise<Mission | null> =>
    missionStore.get(id) ?? null,
  updateMission: async (
    _userId: string,
    id: string,
    patch: Partial<Pick<Mission, 'title' | 'difficulty' | 'dueDate' | 'completed'>>,
  ): Promise<void> => {
    const existing = missionStore.get(id);
    if (!existing) return;
    missionStore.set(id, { ...existing, ...patch });
  },
  setCompleted: async (
    _userId: string,
    id: string,
    completedAt: string | null,
  ): Promise<void> => {
    const existing = missionStore.get(id);
    if (!existing) return;
    missionStore.set(id, {
      ...existing,
      completed: completedAt !== null,
      completedAt,
    });
  },
  deleteMission: async (_userId: string, id: string): Promise<void> => {
    missionStore.delete(id);
  },
};

const usersRepo: Partial<UsersRepository> = {
  findBySub: async (sub: string): Promise<string | null> =>
    sub === 'sub-1' ? UUID : null,
};

// Inline module: import ONLY MissionsModule + ConfigModule (no DatabaseModule/
// AppModule) so the test stays hermetic — a full boot would validate
// DATABASE_URL and abort. Repositories are overridden with stubs below.
@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [
        () => ({
          GOOGLE_CLIENT_ID: 'test-client-id',
          API_PUBLIC_URL: 'https://api.example.com',
          SESSION_SECRET: 'test',
        }),
      ],
    }),
    MissionsModule,
  ],
})
class TestAppModule {}

describe('MissionsController (GET/POST/PUT/PATCH/DELETE /api/missions)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PgService)
      .useValue({
        getPool: () => ({ query: async () => ({ rows: [] as unknown[] }) }),
      })
      .overrideProvider(UsersRepository)
      .useValue(usersRepo)
      .overrideProvider(MissionsRepository)
      .useValue(missionsRepo)
      .overrideProvider(AuthTokensRepository)
      .useValue(tokensRepo)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirror main.ts so the 400 path (invalid DTO) is exercised.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    missionStore.clear();
  });

  it('POST /api/missions with a client id returns that id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', title: 'T', difficulty: 'facil' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(res.body.title).toBe('T');
    expect(res.body.difficulty).toBe('facil');
    expect(res.body.completed).toBe(false);
    expect(res.body.completedAt).toBeNull();
  }, 120000);

  it('POST /api/missions without an id generates a uuid', async () => {
    const res = await request(app.getHttpServer()).post('/api/missions').set(BEARER).send({ title: 'T', difficulty: 'media' });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }, 120000);

  it('GET /api/missions lists created missions', async () => {
    await request(app.getHttpServer()).post('/api/missions').set(BEARER).send({ title: 'A', difficulty: 'facil' });
    await request(app.getHttpServer()).post('/api/missions').set(BEARER).send({ title: 'B', difficulty: 'dificil' });
    const res = await request(app.getHttpServer()).get('/api/missions').set(BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  }, 120000);

  it('PATCH /api/missions/:id/complete sets a non-null completedAt', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', title: 'T', difficulty: 'facil' });
    expect(created.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch('/api/missions/dddddddd-dddd-dddd-dddd-dddddddddddd/complete').set(BEARER)
      .send({ completed: true });
    expect(res.status).toBe(200);

    const stored = missionStore.get('dddddddd-dddd-dddd-dddd-dddddddddddd');
    expect(stored?.completed).toBe(true);
    expect(stored?.completedAt).not.toBeNull();
  }, 120000);

  it('PATCH /api/missions/:id/complete with completed=false clears completedAt', async () => {
    await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', title: 'T', difficulty: 'facil' });
    await request(app.getHttpServer())
      .patch('/api/missions/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/complete').set(BEARER)
      .send({ completed: true });

    const res = await request(app.getHttpServer())
      .patch('/api/missions/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/complete').set(BEARER)
      .send({ completed: false });
    expect(res.status).toBe(200);
    const stored = missionStore.get('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    expect(stored?.completed).toBe(false);
    expect(stored?.completedAt).toBeNull();
  }, 120000);

  it('PUT /api/missions/:id on a completed mission returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', title: 'T', difficulty: 'facil' });
    await request(app.getHttpServer())
      .patch('/api/missions/ffffffff-ffff-ffff-ffff-ffffffffffff/complete').set(BEARER)
      .send({ completed: true });

    const res = await request(app.getHttpServer())
      .put('/api/missions/ffffffff-ffff-ffff-ffff-ffffffffffff').set(BEARER)
      .send({ title: 'Renamed' });
    expect(res.status).toBe(400);
  }, 120000);

  it('PUT /api/missions/:id on an open mission applies the patch', async () => {
    await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'T', difficulty: 'facil' });

    const res = await request(app.getHttpServer())
      .put('/api/missions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').set(BEARER)
      .send({ title: 'Renamed', difficulty: 'epica' });
    expect(res.status).toBe(200);
    const stored = missionStore.get('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(stored?.title).toBe('Renamed');
    expect(stored?.difficulty).toBe('epica');
  }, 120000);

  it('POST /api/missions with invalid difficulty returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ title: 'T', difficulty: 'bogus' });
    expect(res.status).toBe(400);
  }, 120000);

  it('DELETE /api/missions/:id removes the mission (204)', async () => {
    await request(app.getHttpServer())
      .post('/api/missions').set(BEARER)
      .send({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', title: 'T', difficulty: 'facil' });

    const delRes = await request(app.getHttpServer()).delete(
      '/api/missions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ).set(BEARER);
    expect(delRes.status).toBe(204);
    expect(missionStore.has('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).toBe(false);
  }, 120000);

  it('GET /api/missions is rejected (403) when no bearer token is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/missions');
    expect(res.status).toBe(403);
  }, 120000);
});
