import type { AuthUser } from '../db/auth-tokens.repository';

declare module 'express' {
  interface Request {
    /**
     * Populated by SessionGuard after a valid bearer token is resolved.
     * Present on any route that reached its handler through the guard.
     */
    authUser?: AuthUser;
  }
}
