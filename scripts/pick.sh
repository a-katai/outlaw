#!/bin/bash
# Record a draft pick from the command line, by name.
#   scripts/pick.sh "Toe Dragons" "Larry Rowe"
#   scripts/pick.sh --board            # who's on the clock + last 10 picks
#   scripts/pick.sh --undo             # undo the last pick
# Fuzzy-matches both team and player; refuses ambiguous or already-drafted names.
set -euo pipefail
cd "$(dirname "$0")/.."
REF=cqltfdekmfxlsgrvxtlr
TOKEN=$(grep -o 'sbp_[A-Za-z0-9]*' ~/Studio/dose-app/.env.local | head -1)

q() { curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d "$(python3 -c "import json,sys;print(json.dumps({'query':sys.argv[1]}))" "$1")"; }

case "${1:-}" in
  --board)
    q "select d.status, d.current_pick, d.total_rounds from drafts d order by d.created_at desc limit 1" | python3 -m json.tool
    q "select p.pick_number, p.round, t.name as team, pl.name as player
       from draft_picks p join teams t on t.id=p.team_id join players pl on pl.id=p.player_id
       order by p.pick_number desc limit 10" | python3 -m json.tool
    exit 0;;
  --undo)
    q "select undo_last_pick((select id from drafts order by created_at desc limit 1))" | python3 -m json.tool
    exit 0;;
esac

TEAM="${1:?usage: pick.sh \"Team\" \"Player Name\"}"
PLAYER="${2:?usage: pick.sh \"Team\" \"Player Name\"}"

PAYLOAD=$(q "select
    (select json_agg(json_build_object('id',id,'name',name)) from teams where season_id='2026-27') as teams,
    (select json_agg(json_build_object('id',id,'name',name,'pos',position,'rank',rank)) from players
       where id not in (select player_id from draft_picks)) as avail,
    (select json_build_object('id',id,'current_pick',current_pick,'status',status,'total_rounds',total_rounds)
       from drafts order by created_at desc limit 1) as draft")

RESULT=$(python3 - "$TEAM" "$PLAYER" <<'PY'
import json, sys, difflib, subprocess, os
team_q, player_q = sys.argv[1], sys.argv[2]
d = json.loads(os.environ["PAYLOAD"])[0]
if not d["draft"]:
    print("ERR|no draft exists yet — create one first"); sys.exit(0)
if d["draft"]["status"] not in ("live", "paused"):
    print("ERR|draft status is %s" % d["draft"]["status"]); sys.exit(0)

def match(query, rows, key="name"):
    names = [r[key] for r in rows]
    ql = query.lower()
    exact = [r for r in rows if r[key].lower() == ql]
    if exact: return exact[0], None
    subs = [r for r in rows if ql in r[key].lower()]
    if len(subs) == 1: return subs[0], None
    if len(subs) > 1: return None, "ambiguous: " + ", ".join(r[key] for r in subs[:6])
    close = difflib.get_close_matches(query, names, n=3, cutoff=0.6)
    if len(close) == 1: return next(r for r in rows if r[key] == close[0]), None
    if close: return None, "ambiguous: " + ", ".join(close)
    return None, "no match for %r" % query

t, err = match(team_q, d["teams"])
if err: print("ERR|team " + err); sys.exit(0)
p, err = match(player_q, d["avail"] or [])
if err: print("ERR|player " + err + " (already drafted, or misspelled)"); sys.exit(0)
print("OK|%s|%s|%s|%s|%s" % (d["draft"]["id"], t["id"], p["id"], t["name"], p["name"]))
PY
)
export PAYLOAD

RESULT=$(PAYLOAD="$PAYLOAD" python3 - "$TEAM" "$PLAYER" <<'PY'
import json, sys, difflib, os
team_q, player_q = sys.argv[1], sys.argv[2]
d = json.loads(os.environ["PAYLOAD"])[0]
if not d["draft"]: print("ERR|no draft exists yet"); sys.exit(0)
if d["draft"]["status"] not in ("live","paused"): print("ERR|draft is %s" % d["draft"]["status"]); sys.exit(0)
def match(query, rows):
    ql=query.lower(); names=[r["name"] for r in rows]
    ex=[r for r in rows if r["name"].lower()==ql]
    if ex: return ex[0],None
    sub=[r for r in rows if ql in r["name"].lower()]
    if len(sub)==1: return sub[0],None
    if len(sub)>1: return None,"ambiguous: "+", ".join(r["name"] for r in sub[:6])
    cl=difflib.get_close_matches(query,names,n=3,cutoff=0.6)
    if len(cl)==1: return next(r for r in rows if r["name"]==cl[0]),None
    if cl: return None,"ambiguous: "+", ".join(cl)
    return None,"no match for %r" % query
t,e = match(team_q, d["teams"])
if e: print("ERR|team "+e); sys.exit(0)
p,e = match(player_q, d["avail"] or [])
if e: print("ERR|player "+e+" (already drafted, or misspelled)"); sys.exit(0)
print("OK|%s|%s|%s|%s|%s" % (d["draft"]["id"], t["id"], p["id"], t["name"], p["name"]))
PY
)

case "$RESULT" in
  ERR*) echo "✗ ${RESULT#ERR|}"; exit 1;;
esac
IFS='|' read -r _ DRAFT_ID TEAM_ID PLAYER_ID TEAM_NAME PLAYER_NAME <<< "$RESULT"

# make_pick is the atomic RPC — it advances current_pick and enforces the snake
OUT=$(q "select make_pick('$DRAFT_ID'::uuid, '$TEAM_ID'::uuid, '$PLAYER_ID'::uuid)")
echo "$OUT" | grep -qi error && { echo "✗ $OUT"; exit 1; }
echo "✓ $TEAM_NAME → $PLAYER_NAME"
q "select current_pick from drafts where id='$DRAFT_ID'" | python3 -c "import json,sys;print('  on the clock: pick', json.load(sys.stdin)[0]['current_pick'])"
