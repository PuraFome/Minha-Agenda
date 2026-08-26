/// <reference path="./express-request.d.ts" />

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokensRepository } from '../db/auth-tokens.repository';
import { extractBearerToken } from './bearer';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly tokens: AuthTokensRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req);
    if (!token) {
      return false;
    }
    const user = await this.tokens.findUserByToken(token);
    if (!user) {
      return false;
    }
    req.authUser = user;
    return true;
  }
}
