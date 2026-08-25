import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Sync param decorator that returns the authenticated user's Google `sub`
 * from the session. Must stay synchronous — NestJS param decorators cannot be
 * async. `SessionGuard` already guarantees `req.session.user` exists before the
 * handler runs, so the value is always present on a reachable route.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.session?.user?.sub;
  },
);
