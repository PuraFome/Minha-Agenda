import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { UsersRepository } from '../db/users.repository';
import { SessionGuard } from './session.guard';

// Persisted OAuth handshake state kept server-side for the duration of the
// redirect. Augmenting SessionData keeps `req.session` strongly typed.
declare module 'express-session' {
  interface SessionData {
    state: string;
    nonce: string;
    code_verifier: string;
    expires: number;
    user: {
      sub: string;
      email: string;
      name: string;
      picture: string;
    };
  }
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const TEN_MINUTES_MS = 10 * 60 * 1000;

@Controller('auth')
@Throttle({ auth: {} })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  @Get('google')
  googleLogin(@Req() req: Request, @Res() res: Response): void {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.error(
        'GOOGLE_CLIENT_ID is not configured; cannot start Google OAuth flow',
      );
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured');
    }

    const apiPublicUrl = this.config.get<string>('API_PUBLIC_URL');
    if (!apiPublicUrl) {
      this.logger.error(
        'API_PUBLIC_URL is not configured; cannot build OAuth redirect_uri',
      );
      throw new InternalServerErrorException('API_PUBLIC_URL is not configured');
    }

    // PKCE (S256): verifier 43 chars, challenge = BASE64URL(SHA256(verifier)).
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    req.session.state = state;
    req.session.nonce = nonce;
    req.session.code_verifier = codeVerifier;
    req.session.expires = Date.now() + TEN_MINUTES_MS;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${apiPublicUrl}/api/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
    });

    const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
    res.redirect(authUrl);
  }

  @Get('callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.error(
        'GOOGLE_CLIENT_ID is not configured; cannot verify Google callback',
      );
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured');
    }
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientSecret) {
      this.logger.error(
        'GOOGLE_CLIENT_SECRET is not configured; cannot exchange Google token',
      );
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_SECRET is not configured',
      );
    }
    const apiPublicUrl = this.config.get<string>('API_PUBLIC_URL');
    if (!apiPublicUrl) {
      this.logger.error(
        'API_PUBLIC_URL is not configured; cannot build token redirect_uri',
      );
      throw new InternalServerErrorException('API_PUBLIC_URL is not configured');
    }
    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN');
    if (!frontendOrigin) {
      this.logger.error(
        'FRONTEND_ORIGIN is not configured; cannot redirect after login',
      );
      throw new InternalServerErrorException('FRONTEND_ORIGIN is not configured');
    }

    // (1) CSRF / state validation. Reject without proceeding if the session
    // handshake is missing, expired, or the echoed state does not match.
    const sessionState = req.session.state;
    const sessionExpires = req.session.expires;
    const stateParam = req.query.state as string | undefined;
    if (
      !sessionState ||
      !sessionExpires ||
      sessionExpires < Date.now() ||
      sessionState !== stateParam
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
        code_verifier: req.session.code_verifier ?? '',
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
    if (payload.aud !== clientId || payload.nonce !== req.session.nonce) {
      res.status(403).send();
      return;
    }

    // (4) Extract profile and persist the user + consent timestamp.
    const { sub, email = '', name = '', picture = '' } = payload;
    await this.users.upsertByGoogleSub(sub, email, name, picture);
    await this.users.saveConsent(sub, new Date());

    // (5) Session-fixation defense: regenerate before writing auth state.
    req.session.regenerate((err) => {
      if (err) {
        this.logger.error(`session regeneration failed: ${err.message}`);
        res.status(500).send();
        return;
      }
      req.session.user = { sub, email, name, picture };
      // (6) Redirect back to the frontend.
      res.redirect(frontendOrigin);
    });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy((err) => {
      if (err) {
        this.logger.error(`session destroy failed: ${err.message}`);
        res.status(500).send();
        return;
      }
      // express-session clears the cookie on destroy, but clear it explicitly
      // so the browser drops the stale session id immediately.
      res.clearCookie('connect.sid');
      res.status(200).send({ ok: true });
    });
  }

  @UseGuards(SessionGuard)
  @Delete('account')
  async deleteAccount(@Req() req: Request, @Res() res: Response): Promise<void> {
    const sub = req.session.user?.sub;
    if (!sub) {
      res.status(401).send();
      return;
    }

    await this.users.deleteBySub(sub);

    req.session.destroy((err) => {
      if (err) {
        this.logger.error(`session destroy failed: ${err.message}`);
        res.status(500).send();
        return;
      }
      res.clearCookie('connect.sid');
      res.status(200).send({ ok: true });
    });
  }
}
