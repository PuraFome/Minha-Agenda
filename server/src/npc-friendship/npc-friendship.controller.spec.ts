import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { NpcFriendshipModule } from './npc-friendship.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { AuthTokensRepository } from '../db/auth-tokens.repository';
import { NpcFriendshipRepository } from '../db/npc-friendship.repository';

const UUID = '11111111-1111-1111-1111-111111111111';
const BEARER = { Authorization: 'Bearer ma_test-token' };

const tokensRepo: Partial<AuthTokensRepository> = {
  findUserByToken: async (token: string) =>
    token === 'ma_test-token'
      ? { sub: 'sub-1', email: 'a@b.c', name: 'Name', picture: 'pic' }
      : null,
};

// Hermetic in-memory NpcFriendshipRepository stub. State keyed by userId ->
// (npcId -> completedCount). `level` is derived 1:1 from `completedCount` on
// read, mirroring the real repository. No DATABASE_URL / pg connection.
const friendshipStore = new Map<string, Map<string, number>>();
const friendshipRepo: Partial<NpcFriendshipRepository> = {
  getFriendship: async (
    userId: string,
  ): Promise<Record<string, { completedCount: number; level: number }>> => {
    const userMap = friendshipStore.get(userId) ?? new Map();
    const map: Record<string, { completedCount: number; level: number }> = {};
    for (const [npcId, completedCount] of userMap.entries()) {
      map[npcId] = { completedCount, level: completedCount };
    }
    return map;
  },
  putFriendship: async (
    userId: string,
    entries: { npcId: string; completedCount: number }[],
  ): Promise<void> => {
    let userMap = friendshipStore.get(userId);
    if (!userMap) {
      userMap = new Map();
      friendshipStore.set(userId, userMap);
    }
    for (const entry of entries) {
      userMap.set(entry.npcId, entry.completedCount);
    }
  },
};

const usersRepo: Partial<UsersRepository> = {
  findBySub: async (sub: string): Promise<string | null> =>
    sub === 'sub-1' ? UUID : null,
};

// Inline module: import ONLY NpcFriendshipModule + ConfigModule (no
// DatabaseModule/AppModule) so the test stays hermetic — a full boot would
// validate DATABASE_URL and abort. Repositories are overridden with stubs below.
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
    NpcFriendshipModule,
  ],
})
class TestAppModule {}

describe('NpcFriendshipController (GET/PUT /api/npc-friendship)', () => {
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
      .overrideProvider(NpcFriendshipRepository)
      .useValue(friendshipRepo)
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
    friendshipStore.clear();
  });

  it('GET /api/npc-friendship without auth header is rejected (403)', async () => {
    const res = await request(app.getHttpServer()).get('/api/npc-friendship');
    expect(res.status).toBe(403);
  }, 120000);

  it('GET /api/npc-friendship with auth returns {} initially', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/npc-friendship')
      .set(BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  }, 120000);

  it('PUT /api/npc-friendship stores friendship and GET returns it', async () => {
    const putRes = await request(app.getHttpServer())
      .put('/api/npc-friendship')
      .set(BEARER)
      .send({ friendship: { 'npc-1': { completedCount: 2, level: 2 } } });
    expect(putRes.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get('/api/npc-friendship')
      .set(BEARER);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      'npc-1': { completedCount: 2, level: 2 },
    });
  }, 120000);

  it('PUT /api/npc-friendship with missing friendship body returns 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/npc-friendship')
      .set(BEARER)
      .send({});
    expect(res.status).toBe(400);
  }, 120000);
});
