#!/usr/bin/env bash
# Create a demo git repo plus three agent worktrees, wired to the Bullpen hook.
# Default location: next to this repo (../demo, ../demo-api, ../demo-web, ../demo-db).
# Override with DEMO_DIR=/some/path/demo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="${DEMO_DIR:-$(dirname "$REPO")/demo}"
mkdir -p "$(dirname "$DEMO")"
DEMO="$(cd "$(dirname "$DEMO")" && pwd)/$(basename "$DEMO")"  # absolute, so worktrees land beside it
PARENT="$(dirname "$DEMO")"
HOOK="$REPO/hooks/bullpen_hook.py"

for d in "$DEMO" "$PARENT/demo-api" "$PARENT/demo-web" "$PARENT/demo-db"; do
  if [ -e "$d" ]; then
    echo "$d already exists. Remove it yourself, then rerun." >&2
    exit 1
  fi
done

mkdir -p "$DEMO"
cd "$DEMO"
git init -q -b main
cp -R "$REPO/demo-seed/." "$DEMO/"

mkdir -p .claude
python3 - "$HOOK" > .claude/settings.json <<'PY'
import json, sys
hook = sys.argv[1]
def cmd(event):
    # timeout is in seconds and must exceed the hook's 70 s HTTP timeout (an approval can hold it 60 s).
    # onFailure "block" (Claude Code 2.1.295+): a crashed, killed or timed-out hook blocks the edit.
    h = {"type": "command", "command": f'python3 "{hook}" {event}'}
    if event == "PreToolUse":
        h["timeout"] = 90
        h["onFailure"] = "block"
    return [h]
print(json.dumps({"hooks": {
    "PreToolUse": [{"matcher": "Edit|Write|MultiEdit|Bash", "hooks": cmd("PreToolUse")}],
    "PostToolUse": [{"hooks": cmd("PostToolUse")}],
    "Notification": [{"hooks": cmd("Notification")}],
    "Stop": [{"hooks": cmd("Stop")}],
}}, indent=2))
PY

git add -A
git add -f .claude/settings.json  # .claude/ may be in a global gitignore
git commit -q -m "Demo repo"
git tag -f demo-seed >/dev/null  # demo_reset.sh resets main to this commit

for a in api web db; do
  git worktree add -q -b "agent/$a" "$PARENT/demo-$a"
done

git worktree list
