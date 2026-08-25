import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { SettingsModule } from './settings.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { UserSettingsRepository } from '../db/user-settings.repository';
import { ValidationPipe } from '@nestjs/common';

const UUID = '11111111-1111-1111-1111-111111111111';

// Test-only controller that establishes an authenticated session by writing
// `req.session.user`. Lives in the spec (not application source) so the 200
// path of UserSettingsController can be exercised hermetically via a
// cookie-bearing agent.
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

// Inline module: import ONLY SettingsModule + ConfigModule (no DatabaseModule/
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
    SettingsModule,
  ],
  controllers: [TestSessionController],
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

  it('GET /api/settings returns defaults for a fresh user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ retentionDays: 0, muralActiveTab: 'pending' });
  }, 120000);

  it('PUT /api/settings with retentionDays=-5 stores 0 (clamped)', async () => {
    captured.retentionDays = undefined;
    captured.muralActiveTab = undefined;
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent.put('/api/settings').send({ retentionDays: -5 });
    expect(res.status).toBe(200);
    expect(res.body.retentionDays).toBe(0);
    expect(res.body.muralActiveTab).toBe('pending');
    expect(captured.retentionDays).toBe(0);
    expect(captured.muralActiveTab).toBe('pending');
  }, 120000);

  it('PUT /api/settings with muralActiveTab=bogus returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/__test_session/login');
    const res = await agent
      .put('/api/settings')
      .send({ muralActiveTab: 'bogus' });
    expect(res.status).toBe(400);
  }, 120000);

  it('GET /api/settings is rejected (403) when no session is present', async () => {
    const res = await request(app.getHttpServer()).get('/api/settings');
    expect(res.status).toBe(403);
  }, 120000);
});
