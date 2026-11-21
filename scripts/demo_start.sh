#!/usr/bin/env bash
# Start one headless Claude Code agent per task, each in its own worktree, and return right away.
# Usage: scripts/demo_start.sh [tasks.json]   (default: scripts/demo_tasks.json)
# Tasks file: {"ask": str, "tasks": [{"agent": "api", "task": "..."}, ...]}
# Env: DEMO_DIR (as make_demo.sh), SERVER_URL, BULLPEN_LOG_DIR (/tmp/bullpen), CLAUDE_BIN (claude).
# Logs: $BULLPEN_LOG_DIR/<agent>.log, pid in $BULLPEN_LOG_DIR/<agent>.pid.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TASKS="${1:-$REPO/scripts/demo_tasks.json}"
DEMO="${DEMO_DIR:-$(dirname "$REPO")/demo}"
PARENT="$(dirname "$DEMO")"
SERVER_URL="${SERVER_URL:-http://localhost:8600}"
LOG="${BULLPEN_LOG_DIR:-/tmp/bullpen}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

# Validate in one checked call, so a bad file fails here instead of starting zero agents.
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
python3 - "$TASKS" > "$LIST" <<'PY'
import json, re, sys
try:
    tasks = json.load(open(sys.argv[1]))["tasks"]
    assert isinstance(tasks, list) and tasks
    for t in tasks:
        assert re.fullmatch(r"[a-z]+", t["agent"]) and isinstance(t["task"], str) and t["task"].strip()
except Exception as e:
    sys.exit(f"Bad tasks file {sys.argv[1]}: {e!r}")
for t in tasks:
    sys.stdout.write(t["agent"] + "\0" + t["task"] + "\0")
PY

# Every worktree must exist before any agent starts.
while IFS= read -r -d '' agent && IFS= read -r -d '' task; do
  if [ ! -d "$PARENT/demo-$agent" ]; then
    echo "Worktree $PARENT/demo-$agent is missing. Run scripts/make_demo.sh first." >&2
    exit 1
  fi
done < "$LIST"

mkdir -p "$LOG"
while IFS= read -r -d '' agent && IFS= read -r -d '' task; do
  pid_file="$LOG/$agent.pid"
  if [ -f "$pid_file" ]; then
    old="$(cat "$pid_file")"
    if ps -p "$old" -o command= 2>/dev/null | grep -q -- "$(basename "$CLAUDE_BIN")"; then
      kill "$old" 2>/dev/null || true
    fi
  fi
  # -p: headless. acceptEdits: file edits need no prompt; the PreToolUse hook in the worktree's
  # .claude/settings.json still runs first and its deny always wins. --permission-prompts none:
  # anything else that would prompt is denied instead of hanging. No ANTHROPIC_API_KEY: subscription.
  (
    cd "$PARENT/demo-$agent"
    BULLPEN_AGENT="$agent" SERVER_URL="$SERVER_URL" nohup env -u ANTHROPIC_API_KEY \
      "$CLAUDE_BIN" -p "$task" --permission-mode acceptEdits --permission-prompts none \
      < /dev/null > "$LOG/$agent.log" 2>&1 &
    echo $! > "$pid_file"
  )
  echo "Started $agent (pid $(cat "$pid_file")), log $LOG/$agent.log"
done < "$LIST"
