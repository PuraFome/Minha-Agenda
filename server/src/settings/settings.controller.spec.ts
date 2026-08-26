import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { SettingsModule } from './settings.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { AuthTokensRepository } from '../db/auth-tokens.repository';
import { UserSettingsRepository } from '../db/user-settings.repository';

const UUID = '11111111-1111-1111-1111-111111111111';
const BEARER = { Authorization: 'Bearer ma_test-token' };

const tokensRepo: Partial<AuthTokensRepository> = {
  findUserByToken: async (token: string) =>
    token === 'ma_test-token'
      ? { sub: 'sub-1', email: 'a@b.c', name: 'Name', picture: 'pic' }
      : null,
};

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [
        () => ({
          GOOGLE_CLIENT_ID: 'test-client-id',
          API_PUBLIC_URL: 'https://api.example.com',
        }),
      ],
    }),
    SettingsModule,
  ],
})
class TestAppModule {}

describe('UserSettingsController (GET/PUT /api/settings)', () => {
  let app: INestApplication;

  const usersRepo = {
    findBySub: async (sub: string): Promise<string | null> =>
      sub === 'sub-1' ? UUID : null,
  };
  const captured: { retentionDays?: number; muralActiveTab?: string } = {};
  const settingsRepo = {
    getSettings: async (): Promise<null> => null,
    upsertSettings: async (
      _userId: string,
      retentionDays: number,
      muralActiveTab: string,
    ): Promise<void> => {
      captured.retentionDays = retentionDays;
      captured.muralActiveTab = muralActiveTab;
    },
  };

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
      .overrideProvider(UserSettingsRepository)
      .useValue(settingsRepo)
      .overrideProvider(AuthTokensRepository)
      .useValue(tokensRepo)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirror main.ts so the 400 path (invalid muralActiveTab) is exercised.
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

  it('GET /api/settings returns defaults for a fresh user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .set(BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ retentionDays: 0, muralActiveTab: 'pending' });
  }, 120000);

  it('PUT /api/settings with retentionDays=-5 stores 0 (clamped)', async () => {
    captured.retentionDays = undefined;
    captured.muralActiveTab = undefined;
    const res = await request(app.getHttpServer())
      .put('/api/settings')
      .set(BEARER)
      .send({ retentionDays: -5 });
    expect(res.status).toBe(200);
    expect(res.body.retentionDays).toBe(0);
    expect(res.body.muralActiveTab).toBe('pending');
    expect(captured.retentionDays).toBe(0);
    expect(captured.muralActiveTab).toBe('pending');
  }, 120000);

  it('PUT /api/settings with muralActiveTab=bogus returns 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings')
      .set(BEARER)
      .send({ muralActiveTab: 'bogus' });
    expect(res.status).toBe(400);
  }, 120000);

  it('GET /api/settings is rejected (403) when no bearer token is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/settings');
    expect(res.status).toBe(403);
  }, 120000);
});
