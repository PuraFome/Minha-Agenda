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

-- Short-lived OAuth handshake state: PKCE verifier + nonce + state secret,
-- keyed by an id embedded in the OAuth `state` parameter.
CREATE TABLE IF NOT EXISTS oauth_handshakes (
  id text PRIMARY KEY,
  state_secret text NOT NULL,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Bearer sessions: sha256(token) -> user, so sessions survive process
-- restarts and can be revoked per-token on logout.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS user_data (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  collection text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, collection)
);

-- Relational game tables (idempotent, reuse pgcrypto gen_random_uuid()).
-- `updated_at` is set explicitly by repositories on every write (no trigger).

CREATE TABLE IF NOT EXISTS heroes (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  hero_class text NOT NULL CHECK (hero_class IN ('guerreiro','mago','ladino','clerigo')),
  total_xp int NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('facil','media','dificil','muito-dificil','epica')),
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  retention_days int NOT NULL DEFAULT 0 CHECK (retention_days >= 0),
  mural_active_tab text NOT NULL DEFAULT 'pending' CHECK (mural_active_tab IN ('pending','completed')),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missions_user_id ON missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_user_completed ON missions(user_id, completed);
