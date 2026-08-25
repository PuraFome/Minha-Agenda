import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  Res,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Request, Response } from 'express';
import session from 'express-session';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { MissionsModule } from './missions.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import {
  MissionsRepository,
  Mission,
} from '../db/missions.repository';
import { ValidationPipe } from '@nestjs/common';

const UUID = '11111111-1111-1111-1111-111111111111';

// Test-only controller that establishes an authenticated session by writing
// `req.session.user`. Lives in the spec (not application source) so the 200
// path of MissionsController can be exercised hermetically via a cookie-bearing
// agent.
@Controller('__test_session')
class TestSessionController {
  @Get('login')
  login(@Req() req: Request, @Res() res: Response): void {
    req.session.user = {
      sub: 'sub-1',
      email: 'a@b.c',
      name: 'Name',
      picture: 'pic',
    };
    res.status(200).send();
  }
}

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
  controllers: [TestSessionController],
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
    app.use(
      session({
        secret: 'test',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
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
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent
      .post('/api/missions')
      .send({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', title: 'T', difficulty: 'facil' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(res.body.title).toBe('T');
    expect(res.body.difficulty).toBe('facil');
    expect(res.body.completed).toBe(false);
    expect(res.body.completedAt).toBeNull();
  }, 120000);

  it('POST /api/missions without an id generates a uuid', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent.post('/api/missions').send({ title: 'T', difficulty: 'media' });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }, 120000);

  it('GET /api/missions lists created missions', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    await agent.post('/api/missions').send({ title: 'A', difficulty: 'facil' });
    await agent.post('/api/missions').send({ title: 'B', difficulty: 'dificil' });
    const res = await agent.get('/api/missions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  }, 120000);

  it('PATCH /api/missions/:id/complete sets a non-null completedAt', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const created = await agent
      .post('/api/missions')
      .send({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', title: 'T', difficulty: 'facil' });
    expect(created.status).toBe(201);

    const res = await agent
      .patch('/api/missions/dddddddd-dddd-dddd-dddd-dddddddddddd/complete')
      .send({ completed: true });
    expect(res.status).toBe(200);

    const stored = missionStore.get('dddddddd-dddd-dddd-dddd-dddddddddddd');
    expect(stored?.completed).toBe(true);
    expect(stored?.completedAt).not.toBeNull();
  }, 120000);

  it('PATCH /api/missions/:id/complete with completed=false clears completedAt', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    await agent
      .post('/api/missions')
      .send({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', title: 'T', difficulty: 'facil' });
    await agent
      .patch('/api/missions/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/complete')
      .send({ completed: true });

    const res = await agent
      .patch('/api/missions/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/complete')
      .send({ completed: false });
    expect(res.status).toBe(200);
    const stored = missionStore.get('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    expect(stored?.completed).toBe(false);
    expect(stored?.completedAt).toBeNull();
  }, 120000);

  it('PUT /api/missions/:id on a completed mission returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    await agent
      .post('/api/missions')
      .send({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', title: 'T', difficulty: 'facil' });
    await agent
      .patch('/api/missions/ffffffff-ffff-ffff-ffff-ffffffffffff/complete')
      .send({ completed: true });

    const res = await agent
      .put('/api/missions/ffffffff-ffff-ffff-ffff-ffffffffffff')
      .send({ title: 'Renamed' });
    expect(res.status).toBe(400);
  }, 120000);

  it('PUT /api/missions/:id on an open mission applies the patch', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    await agent
      .post('/api/missions')
      .send({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'T', difficulty: 'facil' });

    const res = await agent
      .put('/api/missions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .send({ title: 'Renamed', difficulty: 'epica' });
    expect(res.status).toBe(200);
    const stored = missionStore.get('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(stored?.title).toBe('Renamed');
    expect(stored?.difficulty).toBe('epica');
  }, 120000);

  it('POST /api/missions with invalid difficulty returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent
      .post('/api/missions')
      .send({ title: 'T', difficulty: 'bogus' });
    expect(res.status).toBe(400);
  }, 120000);

  it('DELETE /api/missions/:id removes the mission (204)', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    await agent
      .post('/api/missions')
      .send({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', title: 'T', difficulty: 'facil' });

    const delRes = await agent.delete(
      '/api/missions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
    expect(delRes.status).toBe(204);
    expect(missionStore.has('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).toBe(false);
  }, 120000);

  it('GET /api/missions is rejected (403) when no session is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/missions');
    expect(res.status).toBe(403);
  }, 120000);
});
