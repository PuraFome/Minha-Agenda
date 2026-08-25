import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import { PgService } from './pg.service';
import { runTxn } from './run-txn';

export type Difficulty =
  | 'facil'
  | 'media'
  | 'dificil'
  | 'muito-dificil'
  | 'epica';

export interface Mission {
  id: string;
  title: string;
  difficulty: Difficulty;
  dueDate?: string | null;
  completed: boolean;
  completedAt?: string | null;
}

/** Raw DB row (snake_case) before mapping to the camelCase `Mission`. */
interface MissionRow {
  id: string;
  user_id: string;
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
}

/** Fields a caller may patch on a mission (identifiers are literals below). */
type MissionPatch = Partial<
  Pick<Mission, 'title' | 'difficulty' | 'dueDate' | 'completed'>
>;

/**
 * Typed access to the `missions` table. Column/table names are literals in the
 * SQL text; only values are bound to `$N` positional parameters. The
 * snake_case (DB) <-> camelCase (TS) mapping lives here.
 */
@Injectable()
export class MissionsRepository {
  constructor(private readonly pg: PgService) {}

  private get pool(): Pool {
    return this.pg.getPool();
  }

  /**
   * Map a raw DB row to the camelCase `Mission` shape.
   */
  private toMission(row: MissionRow): Mission {
    return {
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      dueDate: row.due_date,
      completed: row.completed,
      completedAt: row.completed_at,
    };
  }

  /**
   * List all missions for a user, oldest first.
   */
  async listMissions(userId: string): Promise<Mission[]> {
    const result: QueryResult<MissionRow> = await this.pool.query(
      `SELECT id, user_id, title, difficulty, due_date, completed, completed_at
       FROM missions WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    return result.rows.map((row) => this.toMission(row));
  }

  /**
   * Read a single mission, or `null` when it does not exist / belong to the user.
   */
  async getMission(userId: string, id: string): Promise<Mission | null> {
    const result: QueryResult<MissionRow> = await this.pool.query(
      `SELECT id, user_id, title, difficulty, due_date, completed, completed_at
       FROM missions WHERE user_id = $1 AND id = $2`,
      [userId, id],
    );
    const row = result.rows[0];
    return row ? this.toMission(row) : null;
  }

  /**
   * Create a mission. `mission.id` is supplied by the client (uuid). Runs
   * inside `runTxn`. `due_date`/`completed_at` are cast from the bound values.
   */
  async createMission(userId: string, mission: Mission): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `INSERT INTO missions
           (id, user_id, title, difficulty, due_date, completed, completed_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7::timestamptz, now())`,
        [
          mission.id,
          userId,
          mission.title,
          mission.difficulty,
          mission.dueDate ?? null,
          mission.completed,
          mission.completedAt ?? null,
        ],
      );
    });
  }

  /**
   * Patch a subset of a mission's mutable fields. Only the literal columns for
   * present fields are included; values are bound to `$N`. Runs inside `runTxn`.
   */
  async updateMission(
    userId: string,
    id: string,
    patch: MissionPatch,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [userId, id];
    let n = 3;

    if (patch.title !== undefined) {
      sets.push('title = $' + n);
      params.push(patch.title);
      n++;
    }
    if (patch.difficulty !== undefined) {
      sets.push('difficulty = $' + n);
      params.push(patch.difficulty);
      n++;
    }
    if (patch.dueDate !== undefined) {
      sets.push('due_date = $' + n + '::date');
      params.push(patch.dueDate);
      n++;
    }
    if (patch.completed !== undefined) {
      sets.push('completed = $' + n);
      params.push(patch.completed);
      n++;
    }

    if (sets.length === 0) return;
    sets.push(`updated_at = now()`);

    // Column names above are literals authored here, never interpolated from
    // caller-supplied identifiers. The SET list is composed with string
    // concatenation (not template interpolation) so no SQL text is templated.
    const sql =
      'UPDATE missions SET ' + sets.join(', ') + ' WHERE user_id = $1 AND id = $2';

    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(sql, params);
    });
  }

  /**
   * Mark a mission completed (`completed_at` set) or reopened (`completed_at`
   * cleared). `completed_at` is cast from the bound value. Runs inside `runTxn`.
   */
  async setCompleted(
    userId: string,
    id: string,
    completedAt: string | null,
  ): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `UPDATE missions
         SET completed = $3, completed_at = $4::timestamptz, updated_at = now()
         WHERE user_id = $1 AND id = $2`,
        [userId, id, completedAt !== null, completedAt],
      );
    });
  }

  /**
   * Delete a mission. Runs inside `runTxn`.
   */
  async deleteMission(userId: string, id: string): Promise<void> {
    await runTxn(this.pool, async (client: PoolClient) => {
      await client.query(
        `DELETE FROM missions WHERE user_id = $1 AND id = $2`,
        [userId, id],
      );
    });
  }
}
