import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, INestApplication, Module, Req, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Request, Response } from 'express';
import session from 'express-session';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PgService } from '../db/pg.service';

// Test-only controller that establishes an authenticated session by writing
// `req.session.user`. Lives in the spec (not application source) so the 200
// path of MeController can be exercised hermetically via a cookie-bearing agent.
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

// Inline module: import ONLY AuthModule + ConfigModule (no DatabaseModule/AppModule)
// so the test stays hermetic — a full boot would validate DATABASE_URL and abort.
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
    AuthModule,
  ],
  controllers: [TestSessionController],
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
        // Hermetic stub: MeController never touches the DB, so a real
        // connection (and DATABASE_URL) is unnecessary.
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

  it('returns 401 when no session is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/me');
    expect(res.status).toBe(401);
  }, 120000);

  it('returns 200 with the user JSON when the session has a user', async () => {
    const agent = request.agent(app.getHttpServer());
    // Seed the authenticated session (writes the session cookie).
    await agent.get('/api/__test_session/login');
    const res = await agent.get('/api/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sub: 'sub-1',
      email: 'a@b.c',
      name: 'Name',
      picture: 'pic',
    });
  }, 120000);
});
