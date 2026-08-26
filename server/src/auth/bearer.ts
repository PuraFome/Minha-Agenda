import type { Request } from 'express';

/**
 * Extract the raw token from an `Authorization: Bearer <token>` header.
 * Returns `null` when the header is absent or malformed.
 */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? (match[1]?.trim() || null) : null;
}
