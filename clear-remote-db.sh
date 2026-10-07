#!/usr/bin/env bash
set -euo pipefail

DATABASE="home-business-dev"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$(mktemp)"
trap 'rm -f "$SQL_FILE"' EXIT

cat >"$SQL_FILE" <<'SQL'
-- Child tables first so this works with foreign-key enforcement enabled.
DELETE FROM order_items;
DELETE FROM customer_orders;
DELETE FROM items;
DELETE FROM categories;
DELETE FROM business_contacts;
DELETE FROM session;
DELETE FROM account;
DELETE FROM verification;
DELETE FROM user;
DELETE FROM businesses;

-- Reset generated integer IDs for tables that use AUTOINCREMENT.
DELETE FROM sqlite_sequence;
SQL

printf 'This will permanently delete all application data from the REMOTE D1 database "%s".\n' "$DATABASE"
read -r -p "Type the database name to continue: " confirmation
if [[ "$confirmation" != "$DATABASE" ]]; then
  printf 'Confirmation did not match. Nothing was changed.\n' >&2
  exit 1
fi

cd "$SCRIPT_DIR"
npx wrangler d1 execute "$DATABASE" --remote --file="$SQL_FILE"
