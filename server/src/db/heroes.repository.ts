import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';
import { runTxn } from './run-txn';

export type HeroClass = 'guerreiro' | 'mago' | 'ladino' | 'clerigo';

export interface Hero {
  name: string;
  heroClass: HeroClass;
  totalXp: number;
}

/**
 * Typed access to the `heroes` table. Column/table names are literals in the
 * SQL text; only values are bound to `$N` positional parameters. The
 * snake_case (DB) <-> camelCase (TS) mapping lives here.
 */
@Injectable()
export class HeroesRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Read the hero row for a user, or `null` when none exists.
   */
  async getHero(userId: string): Promise<Hero | null> {
    const result: QueryResult<{ name: string; hero_class: string; total_xp: number }> =
      await this.pool.query(
        `SELECT name, hero_class, total_xp FROM heroes WHERE user_id = $1`,
        [userId],
      );
    const row = result.rows[0];
    if (!row) return null;
    return {
      name: row.name,
      heroClass: row.hero_class as HeroClass,
      totalXp: row.total_xp,
    };
  }

  /**
   * Insert a hero or overwrite it (LWW) on `user_id` conflict, stamping
   * `updated_at = now()`. Runs inside `runTxn`.
   */
  async upsertHero(
    userId: string,
    name: string,
    heroClass: HeroClass,
    totalXp: number,
  ): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `INSERT INTO heroes (user_id, name, hero_class, total_xp, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id) DO UPDATE
           SET name = $2, hero_class = $3, total_xp = $4, updated_at = now()`,
        [userId, name, heroClass, totalXp],
      );
    });
  }

  /**
   * Add `delta` XP, clamping `total_xp` at >= 0. Runs inside `runTxn`.
   */
  async addXp(userId: string, delta: number): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `UPDATE heroes SET total_xp = GREATEST(0, total_xp + $2), updated_at = now()
         WHERE user_id = $1`,
        [userId, delta],
      );
    });
  }

  /**
   * Delete the hero row for a user. Runs inside `runTxn`.
   */
  async deleteHero(userId: string): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(`DELETE FROM heroes WHERE user_id = $1`, [userId]);
    });
  }
}
