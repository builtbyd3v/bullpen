import json
import stat
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main  # noqa: E402

TASKS = [
    {"agent": "db", "task": "Add a users table"},
    {"agent": "api", "task": "Add POST /signup"},
    {"agent": "web", "task": "Add the signup page"},
]

# Same envelope shape as a real `claude -p --output-format json --json-schema` run.
FAKE_CLAUDE = """#!/bin/bash
printf '%s\\n' "$@" > "$FAKE_DIR/claude_args"
case "${FAKE_CLAUDE_MODE:-ok}" in
  ok) cat "$FAKE_DIR/envelope.json" ;;
  garbage) echo "Sorry, I cannot help with that." ;;
  fail) echo "boom" >&2; exit 1 ;;
  sleep) sleep 30; echo late ;;
esac
"""

FAKE_START = """#!/bin/bash
cp "$1" "$FAKE_DIR/started_tasks.json"
exit "${FAKE_START_RC:-0}"
"""


def executable(path: Path, text: str) -> str:
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


class Calls:
    """Records requests to the fake server and Jetson and decides their replies."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.server_up = True
        self.jetson_up = True
        self.state = {
            "main": "main",
            "worktrees": [
                {"agent": "db", "status": "blocked", "building": "sundome", "task": "Add a role column",
                 "commits": [], "claims": []},
                {"agent": "web", "status": "working", "building": "msc", "task": "Show the role",
                 "commits": [{"sha": "1a2b3c4", "message": "Add role"}], "claims": ["msc"]},
            ],
            "approvals": [{"id": "ap1", "agent": "db", "tool": "Edit", "target": "db/schema.sql",
                           "reason": "Sun Dome is guarded"}],
            "leases": [{"file": "shared/auth.ts", "agent": "web", "expires_at": "x", "waiters": ["api"]}],
        }

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        host = request.url.host
        if host == "server.test":
            if not self.server_up:
                raise httpx.ConnectError("server down")
            if request.url.path == "/state":
                return httpx.Response(200, json=self.state)
            return httpx.Response(200, json={"decision": "allow"})
        if host == "jetson.test":
            if not self.jetson_up:
                raise httpx.ConnectError("jetson down")
            return httpx.Response(200, json={"answer": "db waits for approval."})
        return httpx.Response(404)

    def bodies(self, path: str) -> list[dict]:
        return [json.loads(r.content) for r in self.requests if r.url.path == path]


@pytest.fixture
def fake_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_DIR", str(tmp_path))
    return tmp_path


def write_envelope(fake_dir: Path, tasks) -> None:
    (fake_dir / "envelope.json").write_text(json.dumps({
        "type": "result", "subtype": "success", "is_error": False,
        "result": json.dumps({"tasks": tasks}),
        "structured_output": {"tasks": tasks},
    }))


@pytest.fixture(autouse=True)
def isolated(fake_dir, monkeypatch):
    """Never reach a real claude, start script, server, Jetson or canned file."""
    write_envelope(fake_dir, TASKS)
    monkeypatch.setenv("CLAUDE_BIN", executable(fake_dir / "fake_claude", FAKE_CLAUDE))
    monkeypatch.setenv("DEMO_START_CMD", executable(fake_dir / "fake_start", FAKE_START))
    monkeypatch.setenv("SERVER_URL", "http://server.test")
    monkeypatch.setenv("JETSON_URL", "http://jetson.test")
    monkeypatch.setenv("BULLPEN_LOG_DIR", str(fake_dir / "logs"))
    monkeypatch.setenv("BULLPEN_EVENTS_LOG", str(fake_dir / "no-events.log"))
    monkeypatch.setenv("DEMO_DIR", str(fake_dir / "demo"))
    canned = fake_dir / "demo_tasks.json"
    canned.write_text(json.dumps({"ask": "canned ask", "tasks": [
        {"agent": "api", "task": "canned api"},
        {"agent": "web", "task": "canned web"},
        {"agent": "db", "task": "canned db"},
    ]}))
    monkeypatch.setattr(main, "CANNED_TASKS", canned)
    monkeypatch.setattr(main, "CLI_TIMEOUT", 5)


@pytest.fixture
def calls(monkeypatch):
    c = Calls()
    monkeypatch.setattr(main, "http", httpx.Client(transport=httpx.MockTransport(c.handler)))
    return c


@pytest.fixture
def client(calls):
    return TestClient(main.app)

