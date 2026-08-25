/**
 * Idempotent backfill: reads every user_data row, groups by user_id, and
 * upserts into the relational tables (heroes, missions, user_settings).
 *
 * Usage:  cd server && set -a && source .env && set +a && npm run migrate:data
 *
 * Key merge rules per user:
 *   retention_days = settings.retentionDays ?? perfil.retentionDays ?? 0
 *                    (settings wins over perfil on conflict — logged)
 *   mural_active_tab = mural.activeTab ?? 'pending'
 *
 * Retention: user_data is NEVER deleted (per plan guardrail).
 */

import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { runTxn } from '../src/db/run-txn';

/* ── helpers ──────────────────────────────────────────────────────────── */

function redact(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//***@${u.host}${u.pathname}`;
  } catch {
    return 'postgresql://***';
  }
}

function log(msg: string): void {
  console.log(`[backfill] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[backfill] WARN: ${msg}`);
}

/* ── types ────────────────────────────────────────────────────────────── */

interface UserDataRow {
  user_id: string;
  collection: string;
  payload: unknown;
}

interface HeroPayload {
  name: string;
  heroClass: string;
  totalXp: number;
}

interface MissionPayload {
  id: string;
  title: string;
  difficulty: string;
  dueDate?: string | null;
  completed: boolean;
  completedAt?: string | null;
}

interface SettingsPayload {
  retentionDays?: number;
}

interface MuralPayload {
  activeTab?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* ── main ─────────────────────────────────────────────────────────────── */

export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.error(
      '[backfill] DATABASE_URL is missing or empty. Set it in server/.env ' +
        'before running. Aborting.',
    );
    process.exit(1);
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: 'minha-agenda-backfill',
    max: 1,
  });

  log(`connecting to ${redact(databaseUrl)}`);

  /* ── 1. Read all user_data rows ─────────────────────────────────────── */

  const { rows } = await pool.query<UserDataRow>(
    `SELECT user_id::text AS user_id, collection, payload FROM user_data`,
  );
  log(`read ${rows.length} user_data row(s)`);

  if (rows.length === 0) {
    log('nothing to backfill — user_data is empty');
    await pool.end();
    return;
  }

  /* ── 2. Group by user_id ────────────────────────────────────────────── */

  const byUser = new Map<string, UserDataRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const users = [...byUser.keys()];
  log(`found ${users.length} distinct user(s)`);

  /* ── 3. Process each user ───────────────────────────────────────────── */

  let heroesCount = 0;
  let settingsCount = 0;
  let totalMissions = 0;
  let skippedMissions = 0;

  for (const userId of users) {
    const userRows = byUser.get(userId)!;
    const collections = new Map(userRows.map((r) => [r.collection, r.payload]));

    /* ── hero ─────────────────────────────────────────────────────────── */

    const heroRaw = collections.get('hero') as HeroPayload | undefined;
    if (!heroRaw?.name || !heroRaw.heroClass || typeof heroRaw.totalXp !== 'number') {
      warn(`user ${userId}: no valid hero payload — skipping heroes row`);
    } else {
      await runTxn(pool, (client: PoolClient) =>
        client.query(
          `INSERT INTO heroes (user_id, name, hero_class, total_xp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET name = $2, hero_class = $3, total_xp = $4, updated_at = now()`,
          [userId, heroRaw.name, heroRaw.heroClass, heroRaw.totalXp],
        ),
      );
      heroesCount++;
    }

    /* ── user_settings (merged from settings + perfil + mural) ────────── */

    const settingsRaw = collections.get('settings') as SettingsPayload | undefined;
    const perfilRaw = collections.get('perfil') as SettingsPayload | undefined;
    const muralRaw = collections.get('mural') as MuralPayload | undefined;

    // retention_days: settings wins over perfil
    const settingsRD =
      typeof settingsRaw?.retentionDays === 'number' ? settingsRaw.retentionDays : undefined;
    const perfilRD =
      typeof perfilRaw?.retentionDays === 'number' ? perfilRaw.retentionDays : undefined;

    let retentionDays: number;
    if (settingsRD !== undefined && perfilRD !== undefined && settingsRD !== perfilRD) {
      warn(
        `user ${userId}: settings.retentionDays (${settingsRD}) vs perfil.retentionDays ` +
          `(${perfilRD}) — using settings value (${settingsRD})`,
      );
      retentionDays = settingsRD;
    } else if (settingsRD !== undefined) {
      retentionDays = settingsRD;
    } else if (perfilRD !== undefined) {
      retentionDays = perfilRD;
    } else {
      retentionDays = 0;
    }

    // mural_active_tab
    const rawTab = muralRaw?.activeTab;
    const muralActiveTab = rawTab === 'pending' || rawTab === 'completed' ? rawTab : 'pending';
    if (rawTab !== undefined && rawTab !== 'pending' && rawTab !== 'completed') {
      warn(
        `user ${userId}: invalid mural.activeTab "${rawTab}" — defaulting to "pending"`,
      );
    }

    await runTxn(pool, (client: PoolClient) =>
      client.query(
        `INSERT INTO user_settings (user_id, retention_days, mural_active_tab)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET retention_days = $2, mural_active_tab = $3, updated_at = now()`,
        [userId, retentionDays, muralActiveTab],
      ),
    );
    settingsCount++;

    /* ── missions (JSON array → individual rows) ──────────────────────── */

    const allMissionsPayload = userRows
      .filter((r) => r.collection === 'missions')
      .map((r) => r.payload);

    // Flatten all mission arrays across rows for this user, dedup by id
    const seenMissionIds = new Set<string>();
    const missions: MissionPayload[] = [];
    let skippedUser = 0;

    for (const payload of allMissionsPayload) {
      if (!Array.isArray(payload)) continue;
      for (const m of payload) {
        const candidate = m as MissionPayload;
        if (
          typeof candidate?.id !== 'string' ||
          typeof candidate?.title !== 'string' ||
          typeof candidate?.difficulty !== 'string'
        ) {
          skippedUser++;
          skippedMissions++;
          continue;
        }
        if (!UUID_RE.test(candidate.id)) {
          skippedUser++;
          skippedMissions++;
          continue;
        }
        if (seenMissionIds.has(candidate.id)) {
          continue; // dedup across multiple user_data rows
        }
        seenMissionIds.add(candidate.id);
        missions.push(candidate);
      }
    }

    if (missions.length > 0) {
      // Build a single INSERT with all missions for this user, using unnest for
      // clean parameterized batch insert.
      await runTxn(pool, (client: PoolClient) =>
        client.query(
          `INSERT INTO missions (id, user_id, title, difficulty, due_date, completed, completed_at)
           SELECT
             (elem->>'id')::uuid,
             $1::uuid,
             elem->>'title',
             elem->>'difficulty',
             CASE WHEN elem->>'dueDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
               THEN (elem->>'dueDate')::date
               ELSE NULL
             END,
             (elem->>'completed')::boolean,
             CASE WHEN elem->>'completedAt' IS NOT NULL
               THEN (elem->>'completedAt')::timestamptz
               ELSE NULL
             END
            FROM jsonb_array_elements($2::jsonb) AS t(elem)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             difficulty = EXCLUDED.difficulty,
             due_date = EXCLUDED.due_date,
             completed = EXCLUDED.completed,
             completed_at = EXCLUDED.completed_at,
             updated_at = now()`,
          [userId, JSON.stringify(missions)],
        ),
      );
    }

    totalMissions += missions.length;
    if (skippedUser > 0) {
      warn(
        `user ${userId}: ${missions.length} mission(s) upserted, ` +
          `${skippedUser} skipped (invalid uuid or shape)`,
      );
    } else {
      log(`user ${userId}: hero ✓, settings ✓, ${missions.length} mission(s) ✓`);
    }
  }

  /* ── 4. Summary & verification ──────────────────────────────────────── */

  log('── backfill complete ──');
  log(`heroes upserted:      ${heroesCount}`);
  log(`user_settings upserted: ${settingsCount}`);
  log(`missions upserted:    ${totalMissions}`);
  log(`missions skipped:     ${skippedMissions}`);

  // Verify counts via node pg
  const heroesResult = await pool.query<{ count: string }>(
    `SELECT count(*) AS count FROM heroes`,
  );
  const missionsResult = await pool.query<{ count: string }>(
    `SELECT count(*) AS count FROM missions`,
  );
  const settingsResult = await pool.query<{ count: string }>(
    `SELECT count(*) AS count FROM user_settings`,
  );

  const dbHeroes = Number(heroesResult.rows[0].count);
  const dbMissions = Number(missionsResult.rows[0].count);
  const dbSettings = Number(settingsResult.rows[0].count);

  log(`── db counts ──`);
  log(`heroes:      ${dbHeroes}`);
  log(`missions:    ${dbMissions}`);
  log(`user_settings: ${dbSettings}`);

  // Cross-check: missions in DB should equal source valid-uuid count
  if (dbMissions !== totalMissions) {
    warn(
      `mismatch: db missions (${dbMissions}) != source valid-uuid missions ` +
        `(${totalMissions}). This may indicate pre-existing rows.`,
    );
  }

  // Source count for reference
  const sourceCountResult = await pool.query<{ count: string }>(
    `SELECT COALESCE(SUM(jsonb_array_length(payload)), 0) AS count
     FROM user_data
     WHERE collection = 'missions'`,
  );
  const sourceTotalMissions = Number(sourceCountResult.rows[0].count);
  log(`source total mission objects (all): ${sourceTotalMissions}`);
  log(
    `backfilled valid-uuid missions: ${totalMissions}, skipped: ${skippedMissions}`,
  );

  await pool.end();
  log('done');
}

const invokedDirectly =
  !!process.argv[1] && /backfill-relations(\.[jt]s)?$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backfill] unexpected error: ${message}`);
    process.exit(1);
  });
}
