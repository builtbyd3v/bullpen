#!/usr/bin/env bash
# Reset the demo to a clean state in a few seconds. Safe to run twice.
# Env: DEMO_DIR, BULLPEN_LOG_DIR (default /tmp/bullpen), JETSON_URL (default http://192.168.55.1:8700)
set -uo pipefail

START=$SECONDS
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="${DEMO_DIR:-$(dirname "$REPO")/demo}"
LOGDIR="${BULLPEN_LOG_DIR:-/tmp/bullpen}"
JETSON="${JETSON_URL:-http://192.168.55.1:8700}"

if [ ! -d "$DEMO/.git" ]; then
  echo "demo repo missing, running make_demo.sh"
  DEMO_DIR="$DEMO" bash "$REPO/scripts/make_demo.sh" >/dev/null || { echo "make_demo.sh failed" >&2; exit 1; }
fi
DEMO="$(cd "$DEMO" && pwd)"
PARENT="$(dirname "$DEMO")"

# 1. Kill running agents (pid files written by demo_start.sh).
for a in api web db; do
  pf="$LOGDIR/$a.pid"
  if [ -f "$pf" ]; then
    pid="$(tr -dc '0-9' < "$pf")"
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$pf"
  fi
done

# 2. Main back to the seed commit (tag demo-seed, else the first commit).
SEED_REF="demo-seed"
git -C "$DEMO" rev-parse -q --verify "refs/tags/$SEED_REF" >/dev/null \
  || SEED_REF="$(git -C "$DEMO" rev-list --max-parents=0 main | tail -1)"
git -C "$DEMO" checkout -q main 2>/dev/null || true
git -C "$DEMO" reset -q --hard "$SEED_REF"
git -C "$DEMO" clean -qfd

# 3. Each agent branch back to main, working tree clean.
for a in api web db; do
  wt="$PARENT/demo-$a"
  if [ -d "$wt" ]; then
    git -C "$wt" reset -q --hard main
    git -C "$wt" clean -qfd
  else
    echo "warning: worktree $wt missing (rerun after removing $DEMO to rebuild)" >&2
  fi
done

# 4. Clear logs.
mkdir -p "$LOGDIR"
rm -f "$LOGDIR"/*.log "$LOGDIR"/*.pid 2>/dev/null || true

# 5. Reset the Jetson (warning only).
curl -fsS -m 3 -X POST "$JETSON/reset" >/dev/null 2>&1 \
  || echo "warning: Jetson /reset failed at $JETSON (ignored)" >&2

echo "Restart the server if leases look stale (it keeps lease state in memory)."
echo "reset done in $((SECONDS - START)) s"
