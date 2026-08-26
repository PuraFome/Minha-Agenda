import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthTokensRepository } from '../db/auth-tokens.repository';
import { extractBearerToken } from './bearer';

@Controller('me')
@SkipThrottle({ auth: true, data: true })
export class MeController {
  constructor(private readonly tokens: AuthTokensRepository) {}

  @Get()
  async getMe(
    @Headers() headers: Request['headers'],
  ): Promise<{ sub: string; email: string; name: string; picture: string }> {
    const token = extractBearerToken({ headers } as Request);
    const user = token ? await this.tokens.findUserByToken(token) : null;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
