"""Test harness: a fake Jetson, throwaway demo repos with agent worktrees, a real server process,
and a WebSocket listener. Standard library plus the server's own dependencies only.

Run from server/:  python -m unittest discover tests   (or: uv run python -m unittest discover tests)
"""

import atexit
import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

TMP = Path(tempfile.mkdtemp(prefix="bullpen-tests-"))


def _rm_readonly(func, path, _exc):
    os.chmod(path, stat.S_IWRITE)  # git objects are read-only on Windows
    func(path)


atexit.register(lambda: shutil.rmtree(TMP, onexc=_rm_readonly))

# A fixed campus so building lookups are deterministic. api/internal/ tests the longest prefix.
CAMPUS = TMP / "campus.json"
CAMPUS.write_text(json.dumps({"width": 960, "height": 640, "buildings": [
    {"id": "msc", "name": "MSC", "folder": "web/", "guarded": False},
    {"id": "enb", "name": "ENB", "folder": "api/", "guarded": False},
    {"id": "lab", "name": "Lab", "folder": "api/internal/", "guarded": False},
    {"id": "library", "name": "Library", "folder": "docs/", "guarded": False},
    {"id": "sundome", "name": "Sun Dome", "folder": "db/", "guarded": True},
    {"id": "juniper", "name": "Juniper-Poplar", "folder": None, "guarded": False},
    {"id": "bullrunner", "name": "Bull Runner", "folder": "", "guarded": False},
]}))
# Set before any server module is imported, so config.py picks them up in unit tests too.
os.environ["BULLPEN_CAMPUS"] = str(CAMPUS)
os.environ["BULLPEN_EVENTS_LOG"] = str(TMP / "unit-events.log")
os.environ["BULLPEN_REPO"] = str(TMP / "no-repo-for-unit-tests")


def git(cwd: Path, *args: str) -> str:
    p = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr}")
    return p.stdout


def make_demo(root: Path, agents=("api", "web", "db")) -> tuple[Path, dict[str, Path]]:
    """A demo repo on main plus one worktree per agent on branch agent/<name>, like make_demo.sh."""
    repo = root / "demo"
    repo.mkdir(parents=True)
    git(repo, "init", "-q", "-b", "main")
    for key, value in (("core.autocrlf", "false"), ("user.name", "seed"), ("user.email", "seed@test")):
        git(repo, "config", key, value)
    for folder in ("api", "web", "db", "docs", "shared"):
        (repo / folder).mkdir()
        (repo / folder / "README.md").write_text(f"# {folder}\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "Demo repo")
    worktrees = {}
    for agent in agents:
        path = root / f"demo-{agent}"
        git(repo, "worktree", "add", "-q", "-b", f"agent/{agent}", str(path))
        worktrees[agent] = path
    return repo, worktrees


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class FakeJetson:
    """Stands in for jetson/main.py. Rules: db/ = ask, 'forbidden' files and 'rm -rf' = deny.

    modes[endpoint] = "ok" | "down" (HTTP 503) | "bad" (a reply the server must reject).
    """

    def __init__(self):
        self.modes: dict[str, str] = {}
        self.commit_message = "Test commit message"
        self.calls: list[tuple[str, dict]] = []
        jetson = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                jetson.calls.append((self.path, body))
                mode = jetson.modes.get(self.path, "ok")
                if mode == "down":
                    return self._send(503, {"error": "model down"})
                if mode == "bad":
                    if self.path == "/check":
                        return self._send(200, {"decision": "maybe"})
                    return self._send_raw(200, b"not json")
                return self._send(200, jetson.answer(self.path, body))

            def _send(self, code, payload):
                self._send_raw(code, json.dumps(payload).encode())

            def _send_raw(self, code, data):
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_port}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def answer(self, path: str, body: dict) -> dict:
        if path == "/check":
            file, command = body.get("file") or "", body.get("command") or ""
            if "forbidden" in file or "rm -rf" in command:
                return {"decision": "deny", "reason": "Blocked by test rule", "rule": "test-deny", "model": "rules"}
            if file.startswith("db/") or ("db/" in command and not command.startswith("cat ")):
                return {"decision": "ask", "reason": "Sun Dome is guarded", "rule": "db/**", "model": "rules"}
            return {"decision": "allow", "reason": "", "rule": "default", "model": "rules"}
        if path == "/scan":
            ok = "AKIA" not in body.get("diff", "")
            return {"ok": ok, "findings": [] if ok else [{"file": "?", "line": 1, "kind": "aws_key"}]}
        if path == "/commit_msg":
            return {"message": self.commit_message}
        if path == "/summarize":
            return {"intent": f"{body.get('agent')} intent"}
        return {}

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class Server:
    """The real server (uvicorn main:app) in a subprocess, pointed at a demo repo and a Jetson."""

    def __init__(self, repo: Path, jetson_url: str, **env):
        self.port = free_port()
        self.base = f"http://127.0.0.1:{self.port}"
        self.events_log = TMP / f"events-{self.port}.log"
        self.stderr_path = TMP / f"server-{self.port}.err"
        environment = {**os.environ, "BULLPEN_REPO": str(repo), "JETSON_URL": jetson_url,
                       "BULLPEN_CAMPUS": str(CAMPUS), "BULLPEN_EVENTS_LOG": str(self.events_log),
                       **{k: str(v) for k, v in env.items()}}
        self.stderr = self.stderr_path.open("w")
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(self.port),
             "--log-level", "warning"],
            cwd=SERVER_DIR, env=environment, stdout=subprocess.DEVNULL, stderr=self.stderr,
        )
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(f"server exited: {self.stderr_path.read_text()}")
            try:
                if self.call("GET", "/health")[0] == 200:
                    return
            except OSError:
                time.sleep(0.1)
        raise RuntimeError("server did not start in 20 s")

    def call(self, method: str, path: str, body=None, raw: bytes | None = None, timeout: float = 30):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, method=method, data=data,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read() or b"null")
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read() or b"null")

    def stop(self):
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.stderr.close()


class Events:
    """Collects every WebSocket envelope the server sends."""

    def __init__(self, port: int):
        self.items: list[dict] = []
        self.cond = threading.Condition()
        self.ws = None
        connected = threading.Event()
        threading.Thread(target=self._run, args=(port, connected), daemon=True).start()
        if not connected.wait(10):
            raise RuntimeError("WebSocket did not connect")
        time.sleep(0.3)  # let the server register this client before the test sends anything

    def _run(self, port: int, connected: threading.Event):
        from websockets.sync.client import connect

        try:
            with connect(f"ws://127.0.0.1:{port}/ws") as ws:
                self.ws = ws
                connected.set()
                for message in ws:
                    with self.cond:
                        self.items.append(json.loads(message))
                        self.cond.notify_all()
        except Exception:
            pass

    def mark(self) -> int:
        with self.cond:
            return len(self.items)

    def since(self, mark: int, type_: str | None = None) -> list[dict]:
        with self.cond:
            return [e for e in self.items[mark:] if type_ is None or e["type"] == type_]

    def wait(self, type_: str, pred=lambda data: True, since: int = 0, timeout: float = 15) -> dict:
        return self.items[self.wait_index(type_, pred, since, timeout)]

    def wait_index(self, type_: str, pred=lambda data: True, since: int = 0, timeout: float = 15) -> int:
        deadline = time.monotonic() + timeout
        with self.cond:
            while True:
                for i in range(since, len(self.items)):
                    e = self.items[i]
                    if e["type"] == type_ and pred(e["data"]):
                        return i
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    seen = sorted({e["type"] for e in self.items[since:]})
                    raise AssertionError(f"no matching {type_!r} event within {timeout} s (saw {seen})")
                self.cond.wait(remaining)

    def close(self):
        if self.ws is not None:
            self.ws.close()


def wait_until(check, timeout: float = 15, interval: float = 0.1, message: str = "condition"):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(interval)
    raise AssertionError(f"timed out waiting for {message}")


class ServerCase(unittest.TestCase):
    """One fresh demo repo, fake Jetson and server per test class. Tests use distinct files."""

    agents = ("api", "web", "db")
    env: dict = {}
    jetson_url: str | None = None  # override to point the server somewhere else

    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(dir=TMP))
        cls.repo, cls.wt = make_demo(cls.root, cls.agents)
        cls.jetson = FakeJetson()
        cls.server = Server(cls.repo, cls.jetson_url or cls.jetson.url, **cls.env)
        cls.events = Events(cls.server.port)
        cls.pool = ThreadPoolExecutor(8)

    @classmethod
    def tearDownClass(cls):
        cls.pool.shutdown(wait=False, cancel_futures=True)
        cls.events.close()
        cls.server.stop()
        cls.jetson.stop()

    def setUp(self):
        self.jetson.modes.clear()
        self.jetson.commit_message = "Test commit message"

    # -- hook payloads --

    def body(self, agent: str, rel: str | None = None, tool: str = "Edit", **extra) -> dict:
        body = {"agent": agent, "tool_name": tool, "cwd": str(self.wt.get(agent, self.root)),
                "session_id": f"s-{agent}", "tool_input": {}}
        if rel is not None:
            body["tool_input"]["file_path"] = str(self.wt[agent] / rel)
        body.update(extra)
        return body

    def checkout(self, agent: str, rel: str | None = None, tool: str = "Edit", **extra) -> dict:
        status, reply = self.server.call("POST", "/checkout", self.body(agent, rel, tool, **extra))
        self.assertEqual(status, 200, reply)
        return reply

    def checkout_async(self, agent: str, rel: str, tool: str = "Edit", **extra):
        return self.pool.submit(self.checkout, agent, rel, tool, **extra)

    def write(self, agent: str, rel: str, text: str) -> None:
        path = self.wt[agent] / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def post_edit(self, agent: str, rel: str, tool: str = "Edit") -> None:
        body = self.body(agent, rel, tool, event="PostToolUse", hook_event_name="PostToolUse")
        status, _ = self.server.call("POST", "/hook", body)
        self.assertEqual(status, 200)

    def edit_and_commit(self, agent: str, rel: str, text: str) -> dict:
        """Full cycle: checkout, write, PostToolUse, then wait for the commit event."""
        mark = self.events.mark()
        self.assertEqual(self.checkout(agent, rel)["decision"], "allow")
        self.write(agent, rel, text)
        self.post_edit(agent, rel)
        i = self.events.wait_index("commit", lambda d: d["agent"] == agent and rel in d["files"], since=mark)
        self.events.wait("state", since=i + 1)  # the commit's lease release and state follow it
        return self.events.items[i]["data"]

    def hook(self, agent: str, event: str, **extra) -> dict:
        status, reply = self.server.call("POST", "/hook", {"agent": agent, "event": event,
                                                           "cwd": str(self.wt.get(agent, self.root)), **extra})
        self.assertEqual(status, 200, reply)
        return reply

    # -- reads --

    def state(self) -> dict:
        return self.server.call("GET", "/state")[1]

    def worktree(self, agent: str) -> dict:
        return next(w for w in self.state()["worktrees"] if w["agent"] == agent)

    def lease(self, file: str) -> dict | None:
        return next((lease for lease in self.state()["leases"] if lease["file"] == file), None)
