import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { UsersRepository } from '../db/users.repository';
import {
  AuthTokensRepository,
  HandshakeSecrets,
} from '../db/auth-tokens.repository';
import { SessionGuard } from './session.guard';
import { CurrentUserId } from './current-user.decorator';
import { extractBearerToken } from './bearer';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * The OAuth `state` parameter carries `<handshakeId>.<stateSecret>`: the id
 * locates the server-side handshake row, the secret proves the callback came
 * through the redirect we issued (CSRF defense without cookies).
 */
function splitState(
  state: string | undefined,
): { id: string; secret: string } | null {
  if (!state) {
    return null;
  }
  const separatorIndex = state.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === state.length - 1) {
    return null;
  }
  return { id: state.slice(0, separatorIndex), secret: state.slice(separatorIndex + 1) };
}

function secretsMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, receivedBytes);
}

@Controller('auth')
@Throttle({ auth: {} })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
    private readonly tokens: AuthTokensRepository,
  ) {}

  @Get('google')
  async googleLogin(@Res() res: Response): Promise<void> {
    const clientId = this.requireConfig('GOOGLE_CLIENT_ID');
    const apiPublicUrl = this.requireConfig('API_PUBLIC_URL');

    // PKCE (S256): verifier 43 chars, challenge = BASE64URL(SHA256(verifier)).
    const secrets: HandshakeSecrets = {
      stateSecret: randomBytes(24).toString('base64url'),
      nonce: randomBytes(16).toString('hex'),
      codeVerifier: randomBytes(32).toString('base64url'),
    };
    const handshakeId = await this.tokens.createHandshake(secrets);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${apiPublicUrl}/api/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state: `${handshakeId}.${secrets.stateSecret}`,
      nonce: secrets.nonce,
      code_challenge: createHash('sha256')
        .update(secrets.codeVerifier)
        .digest('base64url'),
      code_challenge_method: 'S256',
      access_type: 'offline',
    });

    res.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
  }

  @Get('callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const clientId = this.requireConfig('GOOGLE_CLIENT_ID');
    const clientSecret = this.requireConfig('GOOGLE_CLIENT_SECRET');
    const apiPublicUrl = this.requireConfig('API_PUBLIC_URL');
    const frontendRedirectUrl = this.frontendRedirectUrl();

    // (1) CSRF/state validation against the single-use server-side handshake.
    // Unknown id, expired row, or secret mismatch all collapse to 403.
    const parsedState = splitState(req.query.state as string | undefined);
    const handshake = parsedState
      ? await this.tokens.consumeHandshake(parsedState.id)
      : null;
    if (
      !parsedState ||
      !handshake ||
      !secretsMatch(handshake.stateSecret, parsedState.secret)
    ) {
      res.status(403).send();
      return;
    }

    const code = req.query.code as string | undefined;

    // (2) PKCE token exchange (form-encoded POST). Node global fetch so the
    // test can stub it. Never request/store a refresh_token.
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code ?? '',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${apiPublicUrl}/api/auth/callback`,
        grant_type: 'authorization_code',
        code_verifier: handshake.codeVerifier,
      }).toString(),
    });
    const tokenJson = (await tokenResponse.json()) as {
      access_token: string;
      id_token: string;
    };
    const { id_token: idToken } = tokenJson;

    // (3) Verify the id_token signature/claims via google-auth-library.
    const oauth2Client = new OAuth2Client(clientId);
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      res.status(403).send();
      return;
    }
    if (payload.aud !== clientId || payload.nonce !== handshake.nonce) {
      res.status(403).send();
      return;
    }

    // (4) Persist user + consent, mint a bearer session and hand it to the SPA
    // through the redirect fragment — browsers never send `#...` to servers.
    const { sub, email = '', name = '', picture = '' } = payload;
    const userId = await this.users.upsertByGoogleSub(sub, email, name, picture);
    await this.users.saveConsent(sub, new Date());
    const sessionToken = await this.tokens.createSession(userId);

    res.redirect(`${frontendRedirectUrl}#token=${sessionToken}`);
  }

  // DEV-ONLY mock login for automated QA; disabled unless ALLOW_DEV_LOGIN=true
  // and NODE_ENV!==production; never enable in production.
  @Get('dev-login')
  async devLogin(@Res() res: Response): Promise<void> {
    const allowed =
      this.config.get<string>('ALLOW_DEV_LOGIN') === 'true' &&
      process.env.NODE_ENV !== 'production';
    if (!allowed) {
      throw new NotFoundException();
    }

    // Fixed deterministic dev profile — never accept arbitrary sub/email.
    const sub = 'dev-user-local';
    const email = 'dev-user-local@example.com';
    const name = 'Dev User';
    const picture = '';

    const userId = await this.users.upsertByGoogleSub(sub, email, name, picture);
    await this.users.saveConsent(sub, new Date());

    const sessionToken = await this.tokens.createSession(userId);
    res.redirect(`${this.frontendRedirectUrl()}#token=${sessionToken}`);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request): Promise<{ ok: boolean }> {
    const token = extractBearerToken(req);
    if (token) {
      await this.tokens.deleteSession(token);
    }
    return { ok: true };
  }

  @UseGuards(SessionGuard)
  @Delete('account')
  async deleteAccount(
    @Req() req: Request,
    @CurrentUserId() sub: string | undefined,
  ): Promise<{ ok: boolean }> {
    void req;
    if (!sub) {
      throw new NotFoundException();
    }

    // auth_sessions rows cascade via users.user_id ON DELETE CASCADE.
    await this.users.deleteBySub(sub);

    const token = extractBearerToken(req);
    if (token) {
      await this.tokens.deleteSession(token);
    }
    return { ok: true };
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      this.logger.error(`${key} is not configured`);
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }

  /**
   * Post-login landing URL. CORS matches the bare Origin header (no path),
   * while GitHub Pages project sites serve the SPA under /<repo>/ — so the
   * redirect target is a separate variable falling back to FRONTEND_ORIGIN.
   */
  private frontendRedirectUrl(): string {
    const origin = this.config.get<string>('FRONTEND_ORIGIN');
    if (!origin) {
      this.logger.error('FRONTEND_ORIGIN is not configured');
      throw new InternalServerErrorException('FRONTEND_ORIGIN is not configured');
    }
    return this.config.get<string>('FRONTEND_REDIRECT_URL') ?? origin;
  }
}
