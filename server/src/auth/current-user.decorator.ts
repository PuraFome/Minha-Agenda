import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Sync param decorator that returns the authenticated user's Google `sub`.
 * Must stay synchronous — NestJS param decorators cannot be async.
 * `SessionGuard` already resolved the bearer token and populated
 * `req.authUser` before the handler runs, so the value is always present on a
 * reachable route.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.authUser?.sub;
  },
);
