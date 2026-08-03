#!/bin/bash
# Nightly export of every Outlaw HL table to ~/Backups/outlaw/YYYY-MM-DD/.
# Service-role key read from the repo's .env.local; paginated (1000-row pages)
# so growing tables (game_stats ≈ 1500 rows/season) never truncate silently.
# Prunes backups older than 30 days. Registered in ~/operator/LOOP.md.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$REPO/.env.local" | cut -d= -f2-)
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$REPO/.env.local" | cut -d= -f2-)
[ -n "$KEY" ] && [ -n "$URL" ] || { echo "missing supabase env"; exit 1; }

DEST="$HOME/Backups/outlaw/$(date +%F)"
mkdir -p "$DEST"

TABLES="seasons teams players games game_stats game_rosters goal_events drafts draft_picks team_codes payments playoff_series access_codes charge_attempts"

for T in $TABLES; do
  OUT="$DEST/$T.json"
  : > "$OUT.tmp"
  OFFSET=0
  PAGE=1000
  printf '[' > "$OUT.tmp"
  FIRST=1
  while :; do
    CHUNK=$(curl -sf --http1.1 --retry 3 --retry-delay 2 --retry-all-errors \
      "$URL/rest/v1/$T?select=*&limit=$PAGE&offset=$OFFSET" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
    ROWS=$(printf '%s' "$CHUNK" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
    if [ "$ROWS" -gt 0 ]; then
      BODY=$(printf '%s' "$CHUNK" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin))[1:-1])")
      if [ "$FIRST" -eq 1 ]; then FIRST=0; else printf ',' >> "$OUT.tmp"; fi
      printf '%s' "$BODY" >> "$OUT.tmp"
    fi
    [ "$ROWS" -lt "$PAGE" ] && break
    OFFSET=$((OFFSET + PAGE))
  done
  printf ']' >> "$OUT.tmp"
  mv "$OUT.tmp" "$OUT"
  COUNT=$(python3 -c "import json; print(len(json.load(open('$OUT'))))")
  echo "$T: $COUNT rows"
done

# prune > 30 days
find "$HOME/Backups/outlaw" -maxdepth 1 -type d -name '20*' -mtime +30 -exec rm -rf {} \;
echo "backup complete: $DEST"
