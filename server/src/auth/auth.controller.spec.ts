import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  Res,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import session from 'express-session';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { AuthModule } from './auth.module';
import { RepositoriesModule } from '../db/repositories.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';

// Mock google-auth-library so the id_token verification step is hermetic.
// The controller does `new OAuth2Client(clientId).verifyIdToken({...})`; we
// expose a shared mock fn so each test can script the returned payload.
const { mockVerifyIdToken } = vi.hoisted(() => ({ mockVerifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerifyIdToken;
    constructor(_clientId: string) {}
  },
}));

// Mutable config map backing the ConfigService mock. Lets each test toggle
// ALLOW_DEV_LOGIN (and other values) without rebuilding the module.
const configMap: Record<string, string | undefined> = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  API_PUBLIC_URL: 'https://api.example.com',
  SESSION_SECRET: 'test',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  FRONTEND_ORIGIN: 'https://frontend.example.com',
  ALLOW_DEV_LOGIN: undefined,
};

// Test-only controller that seeds the OAuth handshake state (state/nonce/
// code_verifier/expires) into the session, mirroring what GET /api/auth/google
// writes. Lets the callback route be exercised without a real Google redirect.
@Controller('__test_handshake')
class TestHandshakeController {
  @Get('seed')
  seed(@Req() req: Request, @Res() res: Response): void {
    req.session.state = 'STATE';
    req.session.nonce = 'NONCE';
    req.session.code_verifier = 'VERIFIER';
    req.session.expires = Date.now() + 10 * 60 * 1000;
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
          GOOGLE_CLIENT_SECRET: 'test-secret',
          FRONTEND_ORIGIN: 'https://frontend.example.com',
        }),
      ],
    }),
    AuthModule,
    RepositoriesModule,
  ],
  controllers: [TestHandshakeController],
})
class TestAppModule {}

const usersRepoStub = {
  upsertByGoogleSub: vi.fn(async () => 'user-uuid'),
  saveConsent: vi.fn(async () => undefined),
  findBySub: vi.fn(async () => 'user-uuid'),
  deleteBySub: vi.fn(async () => undefined),
};

const fetchMock = vi.fn();

describe('AuthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PgService)
      .useValue({
        // Hermetic stub: the redirect/callback tests never touch the DB, so a
        // real connection (and DATABASE_URL) is unnecessary.
        getPool: () => ({ query: async () => ({ rows: [] as unknown[] }) }),
      })
      .overrideProvider(UsersRepository)
      .useValue(usersRepoStub)
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => configMap[key] })
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset dev-login feature flag + NODE_ENV so production/flag tests don't
    // leak into other suites.
    configMap.ALLOW_DEV_LOGIN = undefined;
    process.env.NODE_ENV = 'development';
    // Default: token endpoint returns an id_token; verifyIdToken returns a
    // valid payload (aud + nonce match the seeded session).
    fetchMock.mockResolvedValue({
      json: async () => ({ access_token: 'at', id_token: 'it' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'sub-1',
        email: 'a@b.c',
        name: 'Name',
        picture: 'pic',
        aud: 'test-client-id',
        nonce: 'NONCE',
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET /api/auth/google', () => {
    it('redirects (302) to Google with all required params and sets a session cookie', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/google');

      expect(res.status).toBe(302);

      const location = res.headers.location as string;
      expect(location).toContain('accounts.google.com');

      const url = new URL(location);
      const params = url.searchParams;
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('redirect_uri')).toBe(
        'https://api.example.com/api/auth/callback',
      );
      expect(params.get('response_type')).toBe('code');
      expect(params.get('scope')).toBe('openid email profile');
      expect(params.get('state')).toBeTruthy();
      expect(params.get('nonce')).toBeTruthy();
      expect(params.get('code_challenge')).toBeTruthy();
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('access_type')).toBe('offline');

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieHeader).toMatch(/connect\.sid/);
    }, 120000);
  });

  describe('GET /api/auth/callback', () => {
    it('happy path: 302 redirect, session user set, user persisted', async () => {
      const agent = request.agent(app.getHttpServer());
      // Seed the handshake state (state/nonce/verifier) into the session.
      await agent.get('/api/__test_handshake/seed');

      const res = await agent.get('/api/auth/callback?state=STATE&code=CODE');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://frontend.example.com');

      // Session-fixation: regenerate then set user; /api/me should now resolve.
      const me = await agent.get('/api/me');
      expect(me.status).toBe(200);
      expect(me.body).toEqual({
        sub: 'sub-1',
        email: 'a@b.c',
        name: 'Name',
        picture: 'pic',
      });

      // Token exchange + id_token verify were both invoked.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(1);
      // User was upserted and consent recorded.
      expect(usersRepoStub.upsertByGoogleSub).toHaveBeenCalledWith(
        'sub-1',
        'a@b.c',
        'Name',
        'pic',
      );
      expect(usersRepoStub.saveConsent).toHaveBeenCalledWith(
        'sub-1',
        expect.any(Date),
      );
    }, 120000);

    it('CSRF failure: state mismatch → 403 (no token exchange)', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/__test_handshake/seed'); // session state = STATE

      const res = await agent.get(
        '/api/auth/callback?state=WRONG&code=CODE',
      );

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    }, 120000);

    it('CSRF failure: no handshake session → 403', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=STATE&code=CODE',
      );
      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    }, 120000);

    it('id_token failure: nonce mismatch → 403', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/__test_handshake/seed'); // session nonce = NONCE
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'sub-1',
          aud: 'test-client-id',
          nonce: 'WRONG-NONCE',
        }),
      });

      const res = await agent.get('/api/auth/callback?state=STATE&code=CODE');

      expect(res.status).toBe(403);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);

    it('id_token failure: aud mismatch → 403', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/__test_handshake/seed');
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'sub-1',
          aud: 'wrong-audience',
          nonce: 'NONCE',
        }),
      });

      const res = await agent.get('/api/auth/callback?state=STATE&code=CODE');

      expect(res.status).toBe(403);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);
  });

  describe('GET /api/auth/dev-login', () => {
    it('404 when ALLOW_DEV_LOGIN is unset', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(res.status).toBe(404);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);

    it('404 when ALLOW_DEV_LOGIN is false', async () => {
      configMap.ALLOW_DEV_LOGIN = 'false';
      const res = await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(res.status).toBe(404);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);

    it('404 when NODE_ENV=production even with flag true', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';
      process.env.NODE_ENV = 'production';
      const res = await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(res.status).toBe(404);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);

    it('happy path: 302 redirect, session user set, user persisted', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';
      const agent = request.agent(app.getHttpServer());

      const res = await agent.get('/api/auth/dev-login');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://frontend.example.com');

      // Session-fixation: regenerate then set user; /api/me should now resolve.
      const me = await agent.get('/api/me');
      expect(me.status).toBe(200);
      expect(me.body).toEqual({
        sub: 'dev-user-local',
        email: 'dev-user-local@example.com',
        name: 'Dev User',
        picture: '',
      });

      expect(usersRepoStub.upsertByGoogleSub).toHaveBeenCalledWith(
        'dev-user-local',
        'dev-user-local@example.com',
        'Dev User',
        '',
      );
      expect(usersRepoStub.saveConsent).toHaveBeenCalledTimes(1);
      expect(usersRepoStub.saveConsent).toHaveBeenCalledWith(
        'dev-user-local',
        expect.any(Date),
      );
    }, 120000);

    it('determinism: two calls produce identical sub', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';
      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/auth/dev-login');
      const sub1 = (await agent.get('/api/me')).body.sub;

      // Fresh session/agent — sub must remain the fixed constant.
      const agent2 = request.agent(app.getHttpServer());
      await agent2.get('/api/auth/dev-login');
      const sub2 = (await agent2.get('/api/me')).body.sub;

      expect(sub1).toBe('dev-user-local');
      expect(sub2).toBe('dev-user-local');
      expect(sub1).toBe(sub2);
    }, 120000);
  });
});
