# Database — schema & migrations

## Apply the schema

The DDL lives in [`schema.sql`](./schema.sql) and is **idempotent**
(`CREATE TABLE IF NOT EXISTS`), so it can be re-run safely.

### Option A — Node migration script (default)

```bash
# from server/
npm run migrate        # runs ts-node src/db/migrate.ts
```

`migrate.ts` reads `schema.sql`, splits it into individual statements (node-postgres
does **not** run multiple statements in a single `query()` call), and executes each
one via a `pg.Pool`. It fails fast with a clear message if `DATABASE_URL` is missing
or empty, and masks the password in any log output.

### Option B — CockroachDB CLI (no Node runtime)

```bash
cockroach sql --url $DATABASE_URL -f schema.sql
```

This is the simplest path when you just want to apply the DDL directly on a
CockroachDB cluster — the CLI natively handles multi-statement SQL files.

## Tables

- `users` — `id uuid pk default gen_random_uuid()` (via `pgcrypto`),
  `google_sub text unique not null`, plus profile columns and `consent_at` /
  `created_at` timestamps.
- `user_data` — per-user JSON collections keyed by `(user_id, collection)`,
  `payload jsonb not null`, `updated_at timestamptz default now()`, with
  `ON DELETE CASCADE` back to `users`.
