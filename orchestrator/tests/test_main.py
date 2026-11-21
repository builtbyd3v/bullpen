import json
import subprocess
import time

import main
from conftest import write_envelope


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_valid_split_starts_agents_and_posts_plan(client, calls, fake_dir):
    r = client.post("/orchestrate", json={"ask": "add signup"})

    assert r.status_code == 200
    body = r.json()
    assert body == {
        "ask": "add signup",
        "tasks": [
            {"agent": "api", "task": "Add POST /signup"},
            {"agent": "web", "task": "Add the signup page"},
            {"agent": "db", "task": "Add a users table"},
        ],
        "source": "claude",
        "started": True,
    }
    started = json.loads((fake_dir / "started_tasks.json").read_text())
    assert started == {"ask": "add signup", "tasks": body["tasks"]}
    assert calls.bodies("/hook") == [
        {"event": "Plan", "agent": "orchestrator", "ask": "add signup", "tasks": body["tasks"]}
    ]
    args = (fake_dir / "claude_args").read_text().splitlines()
    assert "-p" in args and "--json-schema" in args and "--output-format" in args


def assert_canned(r, fake_dir):
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "canned"
    assert body["ask"] == "add signup"
    assert [t["task"] for t in body["tasks"]] == ["canned api", "canned web", "canned db"]
    started = json.loads((fake_dir / "started_tasks.json").read_text())
    assert started["tasks"] == body["tasks"]


def test_cli_garbage_falls_back_to_canned(client, fake_dir, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_MODE", "garbage")
    assert_canned(client.post("/orchestrate", json={"ask": "add signup"}), fake_dir)


def test_cli_failure_falls_back_to_canned(client, fake_dir, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_MODE", "fail")
    assert_canned(client.post("/orchestrate", json={"ask": "add signup"}), fake_dir)


def test_cli_missing_falls_back_to_canned(client, fake_dir, monkeypatch):
    monkeypatch.setenv("CLAUDE_BIN", str(fake_dir / "no-such-claude"))
    assert_canned(client.post("/orchestrate", json={"ask": "add signup"}), fake_dir)


def test_cli_timeout_falls_back_to_canned_quickly(client, fake_dir, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_MODE", "sleep")
    monkeypatch.setattr(main, "CLI_TIMEOUT", 1)
    t0 = time.monotonic()
    r = client.post("/orchestrate", json={"ask": "add signup"})
    assert time.monotonic() - t0 < 10  # the non-exec'd `sleep 30` grandchild must not hold us
    assert_canned(r, fake_dir)


def test_wrong_agents_fall_back_to_canned(client, fake_dir):
    write_envelope(fake_dir, [
        {"agent": "api", "task": "a"}, {"agent": "api", "task": "b"}, {"agent": "db", "task": "c"},
    ])
    assert_canned(client.post("/orchestrate", json={"ask": "add signup"}), fake_dir)


def test_empty_task_falls_back_to_canned(client, fake_dir):
    write_envelope(fake_dir, [
        {"agent": "api", "task": "a"}, {"agent": "web", "task": " "}, {"agent": "db", "task": "c"},
    ])
    assert_canned(client.post("/orchestrate", json={"ask": "add signup"}), fake_dir)


def test_no_plan_and_no_canned_file_is_502(client, fake_dir, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_MODE", "garbage")
    monkeypatch.setattr(main, "CANNED_TASKS", fake_dir / "missing.json")
    r = client.post("/orchestrate", json={"ask": "add signup"})
    assert r.status_code == 502
    assert "error" in r.json()
    assert not (fake_dir / "started_tasks.json").exists()


def test_start_command_failing_is_502(client, calls, monkeypatch):
    monkeypatch.setenv("FAKE_START_RC", "3")
    r = client.post("/orchestrate", json={"ask": "add signup"})
    assert r.status_code == 502
    assert "error" in r.json()
    assert calls.bodies("/hook") == []


def test_server_down_on_plan_still_200(client, calls):
    calls.server_up = False
    r = client.post("/orchestrate", json={"ask": "add signup"})
    assert r.status_code == 200
    assert r.json()["started"] is True
    assert r.json()["plan_posted"] is False


def test_empty_or_missing_ask_is_422(client, fake_dir):
    assert client.post("/orchestrate", json={"ask": ""}).status_code == 422
    assert client.post("/orchestrate", json={"ask": "   "}).status_code == 422
    assert client.post("/orchestrate", json={}).status_code == 422
    assert not (fake_dir / "started_tasks.json").exists()


def test_ask_uses_state_summary_as_context(client, calls):
    r = client.post("/ask", json={"question": "why is db waiting?"})
    assert r.status_code == 200
    assert r.json() == {"answer": "db waits for approval."}
    [sent] = calls.bodies("/ask")
    assert sent["question"] == "why is db waiting?"
    ctx = sent["context"]
    assert 'db: status blocked, building sundome, task "Add a role column", 0 commits' in ctx
    assert 'web: status working, building msc, task "Show the role", 1 commits, holds shared/auth.ts' in ctx
    assert "pending approval: db wants Edit db/schema.sql (Sun Dome is guarded)" in ctx
    assert "lease: shared/auth.ts held by web, waiting: api" in ctx


def envelope(type_, data):
    return json.dumps({"at": 1.0, "type": type_, "data": data})


DB_SEQUENCE = [
    envelope("hook", {"agent": "db", "event": "PreToolUse"}),
    envelope("check", {"agent": "db", "tool": "Edit", "file": "db/schema.sql", "decision": "ask",
                       "rule": "db/**", "latency_ms": 4, "model": "rules", "at": "t"}),
    envelope("approval_needed", {"id": "ap1", "agent": "db", "tool": "Edit", "target": "db/schema.sql",
                                 "reason": "Sun Dome is guarded", "expires_at": "t"}),
    envelope("state", {"worktrees": []}),
    "{not json",
    envelope("denied", {"id": "ap1", "agent": "db", "text": "human"}),
    envelope("claim_wait", {"agent": "api", "file": "shared/auth.ts", "building": "x", "holder": "web"}),
    envelope("commit", {"agent": "web", "sha": "1a2b3c4d5e", "message": "Add role",
                        "files": ["shared/auth.ts"], "task": "t"}),
    envelope("mystery", {"agent": "db"}),
]


def test_ask_context_has_recent_events(client, calls, fake_dir, monkeypatch):
    log = fake_dir / "events.log"
    log.write_text("\n".join(DB_SEQUENCE) + "\n")
    monkeypatch.setenv("BULLPEN_EVENTS_LOG", str(log))
    calls.server_up = False

    assert client.post("/ask", json={"question": "Why is db blocked?"}).status_code == 200

    [sent] = calls.bodies("/ask")
    assert sent["context"].splitlines() == [
        "Recent events, oldest first:",
        "check: db Edit db/schema.sql -> ask (rule db/**, 4 ms)",
        "approval_needed: db wants Edit db/schema.sql (Sun Dome is guarded)",
        "denied: a human denied db's Edit db/schema.sql (it needed approval: Sun Dome is guarded)",
        "claim_wait: api waits for shared/auth.ts held by web",
        'commit: web 1a2b3c4 "Add role" (shared/auth.ts)',
    ]


def test_ask_context_capped_keeping_newest(client, calls, fake_dir, monkeypatch):
    log = fake_dir / "events.log"
    log.write_text("\n".join(envelope("commit", {"agent": "web", "sha": f"{i:07d}", "files": ["a.ts"],
                                                 "message": "x" * 100 + f" n{i:04d}"}) for i in range(2000)))
    monkeypatch.setenv("BULLPEN_EVENTS_LOG", str(log))

    assert client.post("/ask", json={"question": "why?"}).status_code == 200

    ctx = calls.bodies("/ask")[0]["context"]
    assert len(ctx) <= main.MAX_CONTEXT_CHARS
    assert "n1999" in ctx
    assert "n1850" not in ctx  # within the last 150 events, but cut by the char cap
    assert ctx.rstrip().endswith("lease: shared/auth.ts held by web, waiting: api")


def test_ask_server_down_still_answers(client, calls, monkeypatch):
    def handler(request):
        if request.url.host == "server.test":
            raise main.httpx.ConnectError("down")
        return calls.handler(request)

    monkeypatch.setattr(main, "http", main.httpx.Client(transport=main.httpx.MockTransport(handler)))
    r = client.post("/ask", json={"question": "why?"})
    assert r.status_code == 200
    assert r.json() == {"answer": "db waits for approval."}
    [sent] = calls.bodies("/ask")
    assert sent["context"] == ""


def test_ask_jetson_down_is_503(client, calls):
    calls.jetson_up = False
    r = client.post("/ask", json={"question": "why?"})
    assert r.status_code == 503
    assert "error" in r.json()


def test_planner_sees_demo_repo_files(client, fake_dir):
    demo = fake_dir / "demo"
    for f in ("shared/auth.ts", "api/users.ts", "web/Header.tsx", "db/schema.sql"):
        (demo / f).parent.mkdir(parents=True, exist_ok=True)
        (demo / f).write_text("x")
    subprocess.run(["git", "init", "-q", str(demo)], check=True)
    subprocess.run(["git", "-C", str(demo), "add", "-A"], check=True)

    r = client.post("/orchestrate", json={"ask": "add login"})

    assert r.json()["source"] == "claude"
    prompt = (fake_dir / "claude_args").read_text()
    for f in ("shared/auth.ts", "api/users.ts", "web/Header.tsx", "db/schema.sql"):
        assert f in prompt


def test_missing_demo_repo_still_plans(client, fake_dir):
    assert not (fake_dir / "demo").exists()
    r = client.post("/orchestrate", json={"ask": "add login"})
    assert r.status_code == 200
    assert r.json()["source"] == "claude"


def test_reset_runs_the_reset_command(client, monkeypatch, tmp_path):
    marker = tmp_path / "reset_ran"
    monkeypatch.setenv("DEMO_RESET_CMD", f"touch {marker}")
    r = client.post("/reset")
    assert r.status_code == 200
    assert r.json()["ok"] is True and isinstance(r.json()["seconds"], float)
    assert marker.exists()


def test_reset_failure_is_502(client, monkeypatch):
    monkeypatch.setenv("DEMO_RESET_CMD", "false")
    r = client.post("/reset")
    assert r.status_code == 502
    assert "error" in r.json()
