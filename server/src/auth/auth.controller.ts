import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';

// Persisted OAuth handshake state kept server-side for the duration of the
// redirect. Augmenting SessionData keeps `req.session` strongly typed.
declare module 'express-session' {
  interface SessionData {
    state: string;
    nonce: string;
    code_verifier: string;
    expires: number;
  }
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TEN_MINUTES_MS = 10 * 60 * 1000;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly config: ConfigService) {}

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
}
