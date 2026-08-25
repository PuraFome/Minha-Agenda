-- Minha-Agenda backend schema (CockroachDB / PostgreSQL compatible).
-- Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS), so `npm run migrate`
-- can be executed multiple times without erroring.

-- CockroachDB ships pgcrypto, which guarantees gen_random_uuid() is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text,
  name text,
  picture text,
  consent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_data (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  collection text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, collection)
);
