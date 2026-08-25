import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';

/**
 * Allowed `user_data.collection` values. This is the security boundary: any
 * collection name MUST be a member of this set before it is passed (as a `$`
 * parameter) into SQL. Never interpolate an unvalidated collection into a query.
 */
export const ALLOWED_COLLECTIONS = [
  'hero',
  'missions',
  'settings',
  'perfil',
  'mural',
] as const;

export type Collection = (typeof ALLOWED_COLLECTIONS)[number];

@Injectable()
export class UsersRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Insert a user keyed by Google `sub`, or update the profile columns on
   * conflict (LWW on email/name/picture). Returns the user `id` (uuid).
   */
  async upsertByGoogleSub(
    sub: string,
    email: string,
    name: string,
    picture: string,
  ): Promise<string> {
    const result: QueryResult<{ id: string }> = await this.pool.query(
      `INSERT INTO users (google_sub, email, name, picture)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_sub) DO UPDATE
         SET email = $2, name = $3, picture = $4
       RETURNING id`,
      [sub, email, name, picture],
    );
    return result.rows[0].id;
  }

  /**
   * Resolve a user `id` from a Google `sub`. Returns `null` when unknown.
   */
  async findBySub(sub: string): Promise<string | null> {
    const result: QueryResult<{ id: string }> = await this.pool.query(
      `SELECT id FROM users WHERE google_sub = $1`,
      [sub],
    );
    return result.rows[0]?.id ?? null;
  }

  /**
   * Record the consent timestamp for the user identified by Google `sub`.
   */
  async saveConsent(sub: string, consentAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE users SET consent_at = $2 WHERE google_sub = $1`,
      [sub, consentAt],
    );
  }

  /**
   * Delete the user identified by Google `sub` (cascades `user_data` via
   * `ON DELETE CASCADE`). Used for LGPD Art. 16 account deletion.
   */
  async deleteBySub(sub: string): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE google_sub = $1', [sub]);
  }
}
