import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PgService } from '../db/pg.service';
import { UsersRepository } from '../db/users.repository';
import { AuthTokensRepository } from '../db/auth-tokens.repository';

// Mock google-auth-library so the id_token verification step is hermetic.
const { mockVerifyIdToken } = vi.hoisted(() => ({ mockVerifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerifyIdToken;
    constructor(_clientId: string) {}
  },
}));

// Mutable config map backing the ConfigService override, so each test can
// toggle values (FRONTEND_REDIRECT_URL / ALLOW_DEV_LOGIN) without rebuilding.
const configMap: Record<string, string | undefined> = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  API_PUBLIC_URL: 'https://api.example.com',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  FRONTEND_ORIGIN: 'https://frontend.example.com',
  FRONTEND_REDIRECT_URL: undefined,
  ALLOW_DEV_LOGIN: undefined,
};

interface StoredHandshake {
  stateSecret: string;
  nonce: string;
  codeVerifier: string;
}

// Deterministic handshake seeded by the stub: tests build `state` as
// `hs-1.<stateSecret>` exactly like the controller does.
let storedHandshake: StoredHandshake | null = null;

const tokensStub = {
  createHandshake: vi.fn(async (secrets: StoredHandshake) => {
    storedHandshake = secrets;
    return 'hs-1';
  }),
  consumeHandshake: vi.fn(
    async (id: string): Promise<StoredHandshake | null> =>
      id === 'hs-1' && storedHandshake ? storedHandshake : null,
  ),
  createSession: vi.fn(async () => 'ma_test-token'),
  findUserByToken: vi.fn(async () => null),
  deleteSession: vi.fn(async () => undefined),
};

const usersRepoStub = {
  upsertByGoogleSub: vi.fn(async () => 'user-uuid'),
  saveConsent: vi.fn(async () => undefined),
  findBySub: vi.fn(async () => 'user-uuid'),
  deleteBySub: vi.fn(async () => undefined),
};

const fetchMock = vi.fn();

function seedHandshake(): void {
  storedHandshake = { stateSecret: 'SECRET', nonce: 'NONCE', codeVerifier: 'VERIFIER' };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [
        () => ({
          GOOGLE_CLIENT_ID: 'test-client-id',
          API_PUBLIC_URL: 'https://api.example.com',
          GOOGLE_CLIENT_SECRET: 'test-secret',
          FRONTEND_ORIGIN: 'https://frontend.example.com',
        }),
      ],
    }),
    AuthModule,
  ],
})
class TestAppModule {}

describe('AuthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PgService)
      .useValue({
        // Hermetic stub: no test touches the real database.
        getPool: () => ({ query: async () => ({ rows: [] as unknown[] }) }),
      })
      .overrideProvider(UsersRepository)
      .useValue(usersRepoStub)
      .overrideProvider(AuthTokensRepository)
      .useValue(tokensStub)
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => configMap[key] })
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
    storedHandshake = null;
    configMap.FRONTEND_REDIRECT_URL = undefined;
    configMap.ALLOW_DEV_LOGIN = undefined;
    process.env.NODE_ENV = 'development';
    fetchMock.mockResolvedValue({
      json: async () => ({ access_token: 'at', id_token: 'it' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    mockVerifyIdToken.mockImplementation(async () => ({
      getPayload: () => ({
        sub: 'sub-1',
        email: 'a@b.c',
        name: 'Name',
        picture: 'pic',
        aud: 'test-client-id',
        nonce: storedHandshake?.nonce,
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET /api/auth/google', () => {
    it('redirects (302) to Google with all required params and no session cookie', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers['set-cookie']).toBeUndefined();

      const url = new URL(res.headers.location as string);
      expect(url.origin + url.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      const params = url.searchParams;
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('redirect_uri')).toBe(
        'https://api.example.com/api/auth/callback',
      );
      expect(params.get('response_type')).toBe('code');
      expect(params.get('scope')).toBe('openid email profile');
      expect(params.get('state')).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(params.get('nonce')).toBeTruthy();
      expect(params.get('code_challenge')).toBeTruthy();
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('access_type')).toBe('offline');

      expect(tokensStub.createHandshake).toHaveBeenCalledTimes(1);
    }, 120000);
  });

  describe('GET /api/auth/callback', () => {
    it('happy path: 302 with #token fragment, user persisted', async () => {
      seedHandshake();

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=hs-1.SECRET&code=CODE',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://frontend.example.com#token=ma_test-token',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const exchangeBody = new URLSearchParams(fetchMock.mock.calls[0][1].body);
      expect(exchangeBody.get('code')).toBe('CODE');
      expect(exchangeBody.get('code_verifier')).toBe('VERIFIER');
      expect(mockVerifyIdToken).toHaveBeenCalledTimes(1);
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
      expect(tokensStub.createSession).toHaveBeenCalledWith('user-uuid');
    }, 120000);

    it('redirects to FRONTEND_REDIRECT_URL when set (SPA under sub-path)', async () => {
      configMap.FRONTEND_REDIRECT_URL =
        'https://frontend.example.com/Minha-Agenda/';
      seedHandshake();

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=hs-1.SECRET&code=CODE',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://frontend.example.com/Minha-Agenda/#token=ma_test-token',
      );
    }, 120000);

    it('CSRF failure: unknown handshake id → 403 (no token exchange)', async () => {
      seedHandshake();

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=unknown-id.SECRET&code=CODE',
      );

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    }, 120000);

    it('CSRF failure: state secret mismatch → 403', async () => {
      seedHandshake();

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=hs-1.WRONG&code=CODE',
      );

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    }, 120000);

    it('CSRF failure: malformed state (no separator) → 403', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=nodot&code=CODE',
      );

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    }, 120000);

    it('id_token failure: nonce mismatch → 403', async () => {
      seedHandshake();
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'sub-1',
          aud: 'test-client-id',
          nonce: 'WRONG-NONCE',
        }),
      });

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=hs-1.SECRET&code=CODE',
      );

      expect(res.status).toBe(403);
      expect(usersRepoStub.upsertByGoogleSub).not.toHaveBeenCalled();
    }, 120000);

    it('id_token failure: aud mismatch → 403', async () => {
      seedHandshake();
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'sub-1',
          aud: 'wrong-audience',
          nonce: storedHandshake?.nonce,
        }),
      });

      const res = await request(app.getHttpServer()).get(
        '/api/auth/callback?state=hs-1.SECRET&code=CODE',
      );

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
    }, 120000);

    it('404 when NODE_ENV=production even with flag true', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';
      process.env.NODE_ENV = 'production';
      const res = await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(res.status).toBe(404);
    }, 120000);

    it('happy path: 302 with #token fragment, fixed dev user persisted', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';

      const res = await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://frontend.example.com#token=ma_test-token',
      );
      expect(usersRepoStub.upsertByGoogleSub).toHaveBeenCalledWith(
        'dev-user-local',
        'dev-user-local@example.com',
        'Dev User',
        '',
      );
      expect(usersRepoStub.saveConsent).toHaveBeenCalledTimes(1);
      expect(tokensStub.createSession).toHaveBeenCalledWith('user-uuid');
    }, 120000);

    it('determinism: two calls produce identical sub', async () => {
      configMap.ALLOW_DEV_LOGIN = 'true';

      await request(app.getHttpServer()).get('/api/auth/dev-login');
      await request(app.getHttpServer()).get('/api/auth/dev-login');

      expect(usersRepoStub.upsertByGoogleSub).toHaveBeenCalledTimes(2);
      expect(usersRepoStub.upsertByGoogleSub.mock.calls[0][0]).toBe(
        'dev-user-local',
      );
      expect(usersRepoStub.upsertByGoogleSub.mock.calls[1][0]).toBe(
        'dev-user-local',
      );
    }, 120000);
  });

  describe('POST /api/auth/logout', () => {
    it('deletes the bearer session and returns ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer ma_some-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(tokensStub.deleteSession).toHaveBeenCalledWith('ma_some-token');
    }, 120000);

    it('returns ok even without a token (idempotent)', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(tokensStub.deleteSession).not.toHaveBeenCalled();
    }, 120000);
  });

  describe('DELETE /api/auth/account', () => {
    it('403 without a bearer token', async () => {
      const res = await request(app.getHttpServer()).delete('/api/auth/account');

      expect(res.status).toBe(403);
      expect(usersRepoStub.deleteBySub).not.toHaveBeenCalled();
    }, 120000);

    it('deletes the account and the presented session', async () => {
      tokensStub.findUserByToken.mockResolvedValue({
        sub: 'sub-1',
        email: 'a@b.c',
        name: 'Name',
        picture: 'pic',
      });

      const res = await request(app.getHttpServer())
        .delete('/api/auth/account')
        .set('Authorization', 'Bearer ma_live-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(usersRepoStub.deleteBySub).toHaveBeenCalledWith('sub-1');
      expect(tokensStub.deleteSession).toHaveBeenCalledWith('ma_live-token');
    }, 120000);
  });
});
