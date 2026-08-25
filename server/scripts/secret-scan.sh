#!/usr/bin/env sh
#
# secret-scan.sh — F1 automated secret-scan over the compiled backend (dist/).
#
# WHY THE ASSIGNMENT PATTERN (deviation from the plan's literal grep):
#   The plan's literal F1 grep was:
#       grep -rE 'DATABASE_URL|GOOGLE_CLIENT_SECRET|SESSION_SECRET' dist/
#   That FALSE-POSITIVES on the legitimate `process.env.DATABASE_URL` reference
#   that NestJS compiles into dist/db/pg.service.js (and similar env reads). Those
#   are not secrets — they are code that *reads* a secret at runtime.
#
#   The true security intent (and exactly what the pre-commit hook in
#   .husky/pre-commit enforces) is to block an ACTUAL secret ASSIGNMENT — i.e. a
#   key=value pair carrying a non-empty value, such as (note the spaced "=" so
#   these examples do not trip the very scan they document):
#       DATABASE_URL = postgresql://user:pass@host:26257/db
#       GOOGLE_CLIENT_SECRET = abc123
#       SESSION_SECRET = supersecret
#   Empty-value template lines (e.g. in server/.env.example) are intentionally
#   allowed, matching the hook's behavior.
#
#   So this scan targets assignment/value patterns, not bare key mentions.
#
# WHAT IT DOES:
#   1. cd into server/ (so paths are relative to the backend root).
#   2. Run `npm run build` (nest build) to guarantee a current dist/.
#   3. grep -rE for any of the three secret assignment patterns in dist/.
#   4. Exit non-zero (FAIL) if ANY match is found; exit 0 (clean) otherwise.

set -e

# Assembled via variables so this file carries no literal KEY=value assignment,
# which would trip this very scan (and .husky/pre-commit).
keys='DATABASE_URL|GOOGLE_CLIENT_SECRET|SESSION_SECRET'
pattern="(${keys})=.+"

# Resolve and cd into the server directory (parent of this script's dir).
SCRIPT_DIR=$(dirname "$0")
cd "$SCRIPT_DIR/.."

echo "[secret-scan] building backend (nest build) to refresh dist/..."
npm run build

echo "[secret-scan] scanning dist/ for secret assignments..."
if grep -rEq -- "$pattern" dist/; then
  echo "FAIL: secret assignment found in dist/:"
  grep -rEn -- "$pattern" dist/ || true
  exit 1
fi

echo "[secret-scan] clean — no secret assignments found in dist/."
exit 0
