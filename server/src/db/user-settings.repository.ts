import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';
import { runTxn } from './run-txn';

export type MuralActiveTab = 'pending' | 'completed';

export interface UserSettings {
  retentionDays: number;
  muralActiveTab: MuralActiveTab;
}

/**
 * Typed access to the `user_settings` table. Column/table names are literals in
 * the SQL text; only values are bound to `$N` positional parameters. The
 * snake_case (DB) <-> camelCase (TS) mapping lives here.
 */
@Injectable()
export class UserSettingsRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Read the settings row for a user, or `null` when none exists.
   */
  async getSettings(userId: string): Promise<UserSettings | null> {
    const result: QueryResult<{ retention_days: number; mural_active_tab: string }> =
      await this.pool.query(
        `SELECT retention_days, mural_active_tab FROM user_settings WHERE user_id = $1`,
        [userId],
      );
    const row = result.rows[0];
    if (!row) return null;
    return {
      retentionDays: row.retention_days,
      muralActiveTab: row.mural_active_tab as MuralActiveTab,
    };
  }

  /**
   * Insert settings or overwrite them (LWW) on `user_id` conflict, stamping
   * `updated_at = now()`. Runs inside `runTxn`.
   */
  async upsertSettings(
    userId: string,
    retentionDays: number,
    muralActiveTab: MuralActiveTab,
  ): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `INSERT INTO user_settings (user_id, retention_days, mural_active_tab, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE
           SET retention_days = $2, mural_active_tab = $3, updated_at = now()`,
        [userId, retentionDays, muralActiveTab],
      );
    });
  }
}
