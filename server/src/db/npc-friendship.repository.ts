import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';
import { runTxn } from './run-txn';

export interface NpcFriendshipEntry {
  npcId: string;
  completedCount: number;
  level: number;
}

/**
 * Typed access to the `npc_friendship` table. Column/table names are literals in
 * the SQL text; only values are bound to `$N` positional parameters. The
 * snake_case (DB) <-> camelCase (TS) mapping lives here.
 *
 * `level` is derived 1:1 from `completed_count` on read and is never persisted.
 */
@Injectable()
export class NpcFriendshipRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Read all friendship rows for a user as a map keyed by `npc_id`.
   * `level` is derived from `completedCount` (1:1). No rows → `{}`.
   */
  async getFriendship(
    userId: string,
  ): Promise<Record<string, { completedCount: number; level: number }>> {
    const result: QueryResult<{ npc_id: string; completed_count: number | string }> =
      await this.pool.query(
        `SELECT npc_id, completed_count FROM npc_friendship WHERE user_id = $1`,
        [userId],
      );
    const map: Record<string, { completedCount: number; level: number }> = {};
    for (const row of result.rows) {
      const completedCount = Number(row.completed_count);
      map[row.npc_id] = { completedCount, level: completedCount };
    }
    return map;
  }

  /**
   * Insert or overwrite friendship entries (LWW) on `(user_id, npc_id)` conflict,
   * stamping `updated_at = now()`. Only `completedCount` persists; `level` is
   * derived and ignored on write. Runs inside `runTxn`.
   */
  async putFriendship(
    userId: string,
    entries: { npcId: string; completedCount: number }[],
  ): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      for (const entry of entries) {
        await client.query(
          `INSERT INTO npc_friendship (user_id, npc_id, completed_count, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (user_id, npc_id) DO UPDATE
             SET completed_count = $3, updated_at = now()`,
          [userId, entry.npcId, entry.completedCount],
        );
      }
    });
  }
}
