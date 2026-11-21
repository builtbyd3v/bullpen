#!/usr/bin/env bash
# Test the demo kit in a temp dir. Run: bash scripts/test_demo_kit.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export DEMO_DIR="$T/demo" BULLPEN_LOG_DIR="$T/logs" JETSON_URL="http://127.0.0.1:9"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

for f in "$REPO"/scripts/*.sh; do bash -n "$f"; done; ok "bash -n"
if command -v uvx >/dev/null; then
  uvx ruff@0.17.6 check --select E9,F "$REPO/scripts" >/dev/null || fail ruff; ok ruff
fi

bash "$REPO/scripts/make_demo.sh" >/dev/null
for f in shared/auth.ts db/schema.sql README.md api/users.ts web/login.tsx; do
  [ -f "$DEMO_DIR/$f" ] || fail "missing $f"; done
for d in api web db shared docs tests config scripts; do [ -d "$DEMO_DIR/$d" ] || fail "no dir $d"; done
[ "$(find "$DEMO_DIR" -mindepth 1 -maxdepth 1 -type d ! -name .git ! -name .claude | wc -l)" -eq 8 ] || fail "need 8 top folders"
grep -q shared/auth "$DEMO_DIR/api/users.ts" 2>/dev/null || grep -q "shared/auth" "$DEMO_DIR/api/users.ts" || fail "api does not import auth"
for a in api web db; do [ -d "$T/demo-$a" ] || fail "worktree $a"; done
[ "$(git -C "$DEMO_DIR" worktree list | wc -l)" -eq 4 ] || fail "worktree count"
python3 - "$DEMO_DIR/.claude/settings.json" <<'PY' || fail "settings.json"
import json, sys
h = json.load(open(sys.argv[1]))["hooks"]
assert sorted(h) == ["Notification", "PostToolUse", "PreToolUse", "Stop"], sorted(h)
pre = h["PreToolUse"][0]["hooks"][0]
assert pre["timeout"] == 90 and pre["onFailure"] == "block", pre
PY
ok "make_demo.sh"

# campus map: exact tracked file counts (web=msc, shared=library, api=enb, tests=enc, config=muma, docs=cooper, scripts=rec, db=sundome)
for pair in web:7 shared:6 api:5 tests:4 config:3 docs:2 db:2 scripts:1; do
  d="${pair%%:*}"; want="${pair##*:}"; got="$(git -C "$DEMO_DIR" ls-files "$d" | wc -l | tr -d ' ')"
  [ "$got" = "$want" ] || fail "$d has $got tracked files, want $want"
done
ok "campus file counts"

# reset
echo dirty > "$T/demo-api/api/users.ts"; echo x > "$T/demo-web/junk.txt"
git -C "$T/demo-db" -c user.name=t -c user.email=t@t commit -q --allow-empty -m extra
mkdir -p "$BULLPEN_LOG_DIR"; sleep 300 & SP=$!; echo $SP > "$BULLPEN_LOG_DIR/api.pid"; echo log > "$BULLPEN_LOG_DIR/api.log"
for i in 1 2; do
  out="$(bash "$REPO/scripts/demo_reset.sh" 2>&1)"
  secs="$(echo "$out" | sed -n 's/.*reset done in \([0-9]*\) s/\1/p')"
  [ -n "$secs" ] && [ "$secs" -lt 15 ] || fail "reset time '$secs' ($out)"
  for a in api web db; do
    [ -z "$(git -C "$T/demo-$a" status --porcelain)" ] || fail "$a dirty (run $i)"
    [ "$(git -C "$T/demo-$a" rev-parse HEAD)" = "$(git -C "$DEMO_DIR" rev-parse HEAD)" ] || fail "$a not at main (run $i)"
  done
  [ -z "$(git -C "$DEMO_DIR" status --porcelain)" ] || fail "main dirty"
  [ "$(git -C "$DEMO_DIR" rev-parse HEAD)" = "$(git -C "$DEMO_DIR" rev-parse demo-seed)" ] || fail "main not at seed"
  [ ! -e "$BULLPEN_LOG_DIR/api.pid" ] && [ ! -e "$BULLPEN_LOG_DIR/api.log" ] || fail "logs not cleared"
done
kill -0 "$SP" 2>/dev/null && fail "agent not killed"
ok "demo_reset.sh twice (${secs}s)"

python3 - "$REPO/scripts/demo_tasks.json" <<'PY' || fail "demo_tasks.json"
import json, sys
d = json.load(open(sys.argv[1]))
assert isinstance(d["ask"], str) and d["ask"]
t = {x["agent"]: x["task"] for x in d["tasks"]}
assert len(d["tasks"]) == 3 and sorted(t) == ["api", "db", "web"]
assert "shared/auth.ts" in t["api"] and "shared/auth.ts" in t["web"] and "db/schema.sql" in t["db"]
assert "docs/" in t["db"] and all("retry in a loop" in v for v in t.values())
PY
ok "demo_tasks.json"

a="$(python3 "$REPO/scripts/baseline.py" | tail -1)"; b="$(python3 "$REPO/scripts/baseline.py" | tail -1)"
[ "$a" = "$b" ] || fail "baseline not deterministic"
n="$(echo "$a" | sed -n 's/lost edits: \([0-9]*\) of.*/\1/p')"; [ "${n:-0}" -gt 0 ] || fail "baseline N=0"
ok "baseline ($a)"
echo "ALL GREEN"
