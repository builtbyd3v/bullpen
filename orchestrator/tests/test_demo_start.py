"""Bash-level tests for scripts/demo_start.sh with a fake claude that records env and cwd."""
import json
import os
import subprocess
import time
from pathlib import Path

import pytest
from conftest import executable

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "demo_start.sh"

RECORDING_CLAUDE = """#!/bin/bash
echo "agent=$BULLPEN_AGENT server=$SERVER_URL cwd=$(pwd -P) args=$*" > "$FAKE_DIR/rec-$BULLPEN_AGENT"
echo "started $BULLPEN_AGENT"
sleep 5
"""


@pytest.fixture
def setup(fake_dir, monkeypatch):
    demo = fake_dir / "demo"
    for a in ("api", "web", "db"):
        (fake_dir / f"demo-{a}").mkdir()
    tasks = fake_dir / "tasks.json"
    tasks.write_text(json.dumps({"ask": "x", "tasks": [
        {"agent": "api", "task": "api task"},
        {"agent": "web", "task": "web task"},
        {"agent": "db", "task": "it's a \"db\" task\nline 2"},
    ]}))
    env = {**os.environ, "DEMO_DIR": str(demo), "SERVER_URL": "http://stub.test:1",
           "BULLPEN_LOG_DIR": str(fake_dir / "logs"),
           "CLAUDE_BIN": executable(fake_dir / "fake_claude", RECORDING_CLAUDE)}
    yield fake_dir, tasks, env
    for pid_file in (fake_dir / "logs").glob("*.pid"):
        subprocess.run(["kill", pid_file.read_text().strip()], capture_output=True)


def run(tasks, env):
    return subprocess.run(["bash", str(SCRIPT), str(tasks)], env=env,
                          capture_output=True, text=True, timeout=10)


def wait_for(path: Path):
    for _ in range(50):
        if path.exists() and path.read_text():
            return path.read_text()
        time.sleep(0.1)
    raise AssertionError(f"{path} never written")


def test_starts_three_agents_detached(setup):
    fake_dir, tasks, env = setup
    t0 = time.monotonic()
    r = run(tasks, env)
    assert r.returncode == 0, r.stderr
    assert time.monotonic() - t0 < 3  # did not wait for the 5 s agents

    for a in ("api", "web", "db"):
        pid = int((fake_dir / "logs" / f"{a}.pid").read_text())
        os.kill(pid, 0)  # still alive
        rec = wait_for(fake_dir / f"rec-{a}")
        assert f"agent={a} " in rec
        assert "server=http://stub.test:1 " in rec
        assert f"cwd={(fake_dir / f'demo-{a}').resolve()} " in rec
        assert wait_for(fake_dir / "logs" / f"{a}.log").strip() == f"started {a}"
    assert "line 2" in (fake_dir / "rec-db").read_text()


def test_rerun_kills_previous_agents(setup):
    fake_dir, tasks, env = setup
    assert run(tasks, env).returncode == 0
    old = int((fake_dir / "logs" / "api.pid").read_text())
    assert run(tasks, env).returncode == 0
    new = int((fake_dir / "logs" / "api.pid").read_text())
    assert new != old
    time.sleep(0.3)
    with pytest.raises(ProcessLookupError):
        os.kill(old, 0)


def test_missing_worktree_fails_before_starting_any(setup):
    fake_dir, tasks, env = setup
    (fake_dir / "demo-web").rmdir()
    r = run(tasks, env)
    assert r.returncode != 0
    assert "demo-web" in r.stderr
    assert not (fake_dir / "logs").exists()


def test_bad_tasks_file_fails(setup):
    fake_dir, tasks, env = setup
    tasks.write_text('{"tasks": []}')
    assert run(tasks, env).returncode != 0
    tasks.write_text("not json")
    assert run(tasks, env).returncode != 0
