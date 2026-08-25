/**
 * Database migration runner for the Minha-Agenda backend.
 *
 * Alternative (no Node runtime needed): apply the DDL directly with the
 * CockroachDB CLI, which natively runs multi-statement SQL files:
 *
 *   cockroach sql --url $DATABASE_URL -f schema.sql
 *
 * This script does the same via node-postgres: it reads `schema.sql`, splits it
 * into individual statements (node-postgres does NOT support multiple statements
 * in a single `query()` call), and executes each one through a `pg.Pool`.
 * `CREATE TABLE IF NOT EXISTS` keeps re-runs idempotent.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';

/**
 * Redact a DATABASE_URL so the password never reaches logs.
 * postgresql://user:pass@host:26257/db?sslmode=verify-full
 *   -> postgresql://***@host:26257/db
 * Mirrors the masking style used in ./pg.service.ts.
 */
function redactDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//***@${u.host}${u.pathname}`;
  } catch {
    return 'postgresql://*** (unparseable)';
  }
}

/** Split a SQL script into individual, non-empty statements on ';'. */
export function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Locate schema.sql robustly whether this script is run via
 * `ts-node src/db/migrate.ts` (from server/) or as a compiled artifact under
 * dist/. Walks up from __dirname and also tries cwd-relative candidates.
 */
export function resolveSchemaPath(): string {
  const candidates: string[] = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'server', 'src', 'db', 'schema.sql'),
  ];
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, 'src', 'db', 'schema.sql'));
    candidates.push(path.join(dir, 'server', 'src', 'db', 'schema.sql'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not locate schema.sql. Tried:\n  ${candidates.join('\n  ')}`,
  );
}

export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.error(
      '[migrate] DATABASE_URL is missing or empty. Set it in server/.env ' +
        '(copy from server/.env.example) before running migrations. Aborting.',
    );
    process.exit(1);
    return;
  }

  const schemaPath = resolveSchemaPath();
  console.log(`[migrate] reading schema from ${schemaPath}`);
  const sql = await fsp.readFile(schemaPath, 'utf8');

  const statements = splitSql(sql);
  if (statements.length === 0) {
    console.error('[migrate] no SQL statements found in schema.sql. Aborting.');
    process.exit(1);
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: 'minha-agenda-migrate',
    max: 1,
  });

  console.log(`[migrate] connecting to ${redactDatabaseUrl(databaseUrl)}`);
  let failed = false;
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[migrate] (${i + 1}/${statements.length}) executing statement...`);
      await pool.query(stmt);
    }
    console.log(
      `[migrate] migration complete: ${statements.length} statement(s) applied.`,
    );
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] migration FAILED: ${message}`);
  } finally {
    await pool.end();
  }

  if (failed) {
    process.exit(1);
  }
}

// Only auto-run when executed as a script (e.g. `npm run migrate` / ts-node),
// not when imported by tests or other modules.
const invokedDirectly =
  !!process.argv[1] && /migrate(\.[jt]s)?$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] unexpected error: ${message}`);
    process.exit(1);
  });
}
