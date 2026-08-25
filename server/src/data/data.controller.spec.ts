import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import session from 'express-session';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { DataModule } from './data.module';
import { AuthModule } from '../auth/auth.module';
import { PgService } from '../db/pg.service';

// Inline module: import ONLY DataModule + ConfigModule + AuthModule (for the
// SessionGuard). Avoid AppModule, which validates DATABASE_URL and aborts boot.
// PgService is overridden with a hermetic stub so no real CockroachDB is needed.
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
    DataModule,
    AuthModule,
  ],
})
class TestAppModule {}

describe('DataController (GET/PUT /api/data/:collection)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PgService)
      .useValue({
        // Hermetic stub: the 401 path is blocked by SessionGuard before any
        // repository/DB call, so a real connection is unnecessary.
        getPool: () => ({ query: async () => ({ rows: [] as unknown[] }) }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
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

  // SessionGuard returns false from canActivate → NestJS responds 403 Forbidden.
  it('GET /api/data/hero is rejected (403) when no session is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/data/hero');
    expect(res.status).toBe(403);
  }, 120000);

  it('PUT /api/data/hero is rejected (403) when no session is present', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/data/hero')
      .send({ name: 'Hero', heroClass: 'Mage', totalXp: 0 });
    expect(res.status).toBe(403);
  }, 120000);

  it('GET /api/data/unknown-collection is rejected (403) — guard runs before collection validation', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/data/not-a-collection',
    );
    expect(res.status).toBe(403);
  }, 120000);
});
