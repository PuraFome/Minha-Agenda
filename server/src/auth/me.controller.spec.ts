import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PgService } from '../db/pg.service';
import { AuthTokensRepository } from '../db/auth-tokens.repository';

const findUserByToken = vi.fn();

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
    AuthModule,
  ],
})
class TestAppModule {}

describe('MeController (GET /api/me)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PgService)
      .useValue({
        // Hermetic stub: MeController resolves users via AuthTokensRepository.
        getPool: () => ({ query: async () => ({ rows: [] as unknown[] }) }),
      })
      .overrideProvider(AuthTokensRepository)
      .useValue({ findUserByToken })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    findUserByToken.mockResolvedValue(null);
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app.getHttpServer()).get('/api/me');
    expect(res.status).toBe(401);
    expect(findUserByToken).not.toHaveBeenCalled();
  }, 120000);

  it('returns 401 when the token is unknown or expired', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', 'Bearer ma_unknown-token');

    expect(res.status).toBe(401);
    expect(findUserByToken).toHaveBeenCalledWith('ma_unknown-token');
  }, 120000);

  it('returns 200 with the user JSON for a valid bearer token', async () => {
    findUserByToken.mockResolvedValue({
      sub: 'sub-1',
      email: 'a@b.c',
      name: 'Name',
      picture: 'pic',
    });

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', 'Bearer ma_valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sub: 'sub-1',
      email: 'a@b.c',
      name: 'Name',
      picture: 'pic',
    });
  }, 120000);
});
