"""Settings, all overridable with env vars. Contract: ../shared/events.md."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # the bullpen repo

# The demo repo that make_demo.sh creates next to this repo (its main checkout, not a worktree).
REPO = Path(os.environ.get("BULLPEN_REPO", ROOT.parent / "demo")).resolve()
MAIN = os.environ.get("BULLPEN_MAIN", "main")
JETSON_URL = os.environ.get("JETSON_URL", "http://192.168.55.1:8700").rstrip("/")
CAMPUS_FILE = Path(os.environ.get("BULLPEN_CAMPUS", ROOT / "campus" / "campus.json"))
EVENTS_LOG = Path(os.environ.get("BULLPEN_EVENTS_LOG", Path(__file__).resolve().parent / "events.log"))

LEASE_TTL = 90  # seconds, events.md section 2
APPROVAL_TIMEOUT = 60  # seconds
# events.md section 2: leases are released when the edit is committed.
# Set False to keep a lease until Stop, undo or expiry instead.
RELEASE_ON_COMMIT = True

EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
COLORS = {"api": "#e5484d", "web": "#3e63dd", "db": "#f5b400"}
EXTRA_COLORS = ["#30a46c", "#8e4ec6", "#f76b15", "#12a594"]
HUB = "bullrunner"  # where an agent stands after undo or merge
