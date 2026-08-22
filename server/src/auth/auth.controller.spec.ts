import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import session from 'express-session';
// @ts-expect-error supertest ships no bundled types in this project (no new npm dep)
import request from 'supertest';
import { AuthModule } from './auth.module';

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
})
class TestAppModule {}

describe('AuthController (GET /api/auth/google)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule);
    // Mirror production routing so the asserted path resolves.
    app.setGlobalPrefix('api');
    // Session middleware is required for the handshake state to persist.
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

    // Session cookie must be set (express-session default name).
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieHeader).toMatch(/connect\.sid/);
    },
    120000,
  );
});
