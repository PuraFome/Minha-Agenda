import { Injectable, BadRequestException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';
import { runTxn } from './run-txn';
import { ALLOWED_COLLECTIONS, Collection } from './users.repository';

@Injectable()
export class UserDataRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Reject any collection name that is not a member of `ALLOWED_COLLECTIONS`.
   * This is the security boundary: only validated names may be passed (as a
   * `$` parameter) into SQL. Throws `BadRequestException` for unknown values.
   */
  private assertCollection(collection: string): void {
    if (!(ALLOWED_COLLECTIONS as readonly string[]).includes(collection)) {
      throw new BadRequestException(`unknown collection: ${collection}`);
    }
  }

  /**
   * Read the stored JSONB `payload` for a (user, collection) pair, or `null`
   * when no row exists.
   */
  async getCollection(
    userId: string,
    collection: Collection,
  ): Promise<unknown | null> {
    this.assertCollection(collection);
    const result: QueryResult<{ payload: unknown }> = await this.pool.query(
      `SELECT payload FROM user_data WHERE user_id = $1 AND collection = $2`,
      [userId, collection],
    );
    return result.rows[0]?.payload ?? null;
  }

  /**
   * Insert or overwrite (LWW) the JSONB `payload` for a (user, collection)
   * pair, stamping `updated_at = now()`. Runs inside `runTxn` so the write is
   * serialized and retryable. Returns the resulting `updated_at`.
   */
  async upsertCollection(
    userId: string,
    collection: Collection,
    payload: unknown,
  ): Promise<Date> {
    this.assertCollection(collection);
    return runTxn(this.pool, async (client: PoolClient) => {
      const result: QueryResult<{ updated_at: Date }> = await client.query(
        `INSERT INTO user_data (user_id, collection, payload, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, collection) DO UPDATE
           SET payload = $3, updated_at = now()
         RETURNING updated_at`,
        [userId, collection, payload],
      );
      return result.rows[0].updated_at;
    });
  }
}
