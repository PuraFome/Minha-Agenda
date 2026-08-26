import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { HeroModule } from './hero.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { AuthTokensRepository } from '../db/auth-tokens.repository';
import { HeroesRepository, Hero, HeroClass } from '../db/heroes.repository';

const UUID = '11111111-1111-1111-1111-111111111111';
const BEARER = { Authorization: 'Bearer ma_test-token' };

const tokensRepo: Partial<AuthTokensRepository> = {
  findUserByToken: async (token: string) =>
    token === 'ma_test-token'
      ? { sub: 'sub-1', email: 'a@b.c', name: 'Name', picture: 'pic' }
      : null,
};

// In-memory HeroesRepository stub that mirrors the real clamping behavior of
// `addXp` (GREATEST(0, total_xp + delta)).
const heroStore = new Map<string, Hero>();
const heroesRepo: Partial<HeroesRepository> = {
  getHero: async (userId: string): Promise<Hero | null> =>
    heroStore.get(userId) ?? null,
  upsertHero: async (
    userId: string,
    name: string,
    heroClass: HeroClass,
    totalXp: number,
  ): Promise<void> => {
    heroStore.set(userId, { name, heroClass, totalXp });
  },
  addXp: async (userId: string, delta: number): Promise<void> => {
    const existing = heroStore.get(userId);
    if (!existing) return;
    heroStore.set(userId, {
      ...existing,
      totalXp: Math.max(0, existing.totalXp + delta),
    });
  },
  deleteHero: async (userId: string): Promise<void> => {
    heroStore.delete(userId);
  },
};

const usersRepo: Partial<UsersRepository> = {
  findBySub: async (sub: string): Promise<string | null> =>
    sub === 'sub-1' ? UUID : null,
};

// Inline module: import ONLY HeroModule + ConfigModule (no DatabaseModule/
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
    HeroModule,
  ],
})
class TestAppModule {}

describe('HeroController (GET/PUT/PATCH/DELETE /api/hero)', () => {
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
      .overrideProvider(HeroesRepository)
      .useValue(heroesRepo)
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
    heroStore.clear();
  });

  it('GET /api/hero returns 404 for a user with no hero', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/hero')
      .set(BEARER);
    expect(res.status).toBe(404);
  }, 120000);

  it('PUT then GET returns the created hero', async () => {
    const putRes = await request(app.getHttpServer())
      .put('/api/hero')
      .set(BEARER)
      .send({ name: 'Zé Droguinha', heroClass: 'mago' });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual({
      name: 'Zé Droguinha',
      heroClass: 'mago',
      totalXp: 0,
    });

    const getRes = await request(app.getHttpServer())
      .get('/api/hero')
      .set(BEARER);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      name: 'Zé Droguinha',
      heroClass: 'mago',
      totalXp: 0,
    });
  }, 120000);

  it('PATCH /api/hero/xp with delta=-5 on 0 clamps to 0', async () => {
    await request(app.getHttpServer())
      .put('/api/hero')
      .set(BEARER)
      .send({ name: 'Zé Droguinha', heroClass: 'mago' });

    const patchRes = await request(app.getHttpServer())
      .patch('/api/hero/xp')
      .set(BEARER)
      .send({ delta: -5 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.totalXp).toBe(0);

    const getRes = await request(app.getHttpServer())
      .get('/api/hero')
      .set(BEARER);
    expect(getRes.body.totalXp).toBe(0);
  }, 120000);

  it('PATCH /api/hero/xp with non-int delta returns 400', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/hero/xp')
      .set(BEARER)
      .send({ delta: 1.5 });
    expect(res.status).toBe(400);
  }, 120000);

  it('DELETE /api/hero removes the hero (204)', async () => {
    await request(app.getHttpServer())
      .put('/api/hero')
      .set(BEARER)
      .send({ name: 'Zé Droguinha', heroClass: 'mago' });

    const delRes = await request(app.getHttpServer())
      .delete('/api/hero')
      .set(BEARER);
    expect(delRes.status).toBe(204);

    const getRes = await request(app.getHttpServer())
      .get('/api/hero')
      .set(BEARER);
    expect(getRes.status).toBe(404);
  }, 120000);

  it('GET /api/hero is rejected (403) when no bearer token is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/hero');
    expect(res.status).toBe(403);
  }, 120000);
});
