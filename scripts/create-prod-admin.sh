#!/usr/bin/env bash
# Creates (or resets) the production super admin with a one-time temporary password.
# Reads VERCEL_TOKEN and PROD_ADMIN_EMAIL from .env. Prints the temporary password once.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${VERCEL_TOKEN:?VERCEL_TOKEN missing in .env}"
: "${PROD_ADMIN_EMAIL:?PROD_ADMIN_EMAIL missing in .env}"

T=team_JTTwWpOjdIAl5GyLgm3LDioG
P=prj_fvxg9wU1JlCpa5Trl82BtCXx8Hpg
ENV_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v10/projects/$P/env?teamId=$T" |
  python3 -c "import sys,json; print([e['id'] for e in json.load(sys.stdin)['envs'] if e['key']=='DATABASE_URL_UNPOOLED' and 'production' in e['target']][0])")
PROD_URL=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v1/projects/$P/env/$ENV_ID?teamId=$T" |
  python3 -c "import sys,json; print(json.load(sys.stdin)['value'])")

TMP=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-12)
DATABASE_URL="$PROD_URL" SEED_ADMIN_EMAIL="$PROD_ADMIN_EMAIL" SEED_ADMIN_PASSWORD="$TMP" SEED_ADMIN_NAME="${PROD_ADMIN_NAME:-Revanth}" npx tsx prisma/seed.ts
psql "$PROD_URL" -qc "update \"User\" set \"mustChangePassword\" = true where role = 'SUPER_ADMIN' and \"mustChangePassword\" = false and \"createdAt\" > now() - interval '5 minutes'"
echo "Users in production:"
psql "$PROD_URL" -tAc "select role, \"mustChangePassword\", \"createdAt\" from \"User\""
echo "Temporary password (change it on first sign-in): $TMP"
