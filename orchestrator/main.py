"""Bullpen orchestrator: one ask -> Claude Code splits it into api, web, db tasks -> agents start.

Contract: shared/events.md section 6b. Runs on the user's Claude subscription through the
`claude` CLI; it never needs ANTHROPIC_API_KEY. /ask is answered by the Jetson, not Claude.
"""
import json
import os
import shlex
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StringConstraints

REPO = Path(__file__).resolve().parents[1]
CANNED_TASKS = REPO / "scripts" / "demo_tasks.json"
AGENTS = ("api", "web", "db")
CLI_TIMEOUT = 45
START_TIMEOUT = 30
JETSON_TIMEOUT = 25
SERVER_TIMEOUT = 5
MAX_CONTEXT_CHARS = 8000

SCHEMA = {
    "type": "object",
    "properties": {"tasks": {
        "type": "array", "minItems": 3, "maxItems": 3,
        "items": {
            "type": "object",
            "properties": {"agent": {"type": "string", "enum": list(AGENTS)}, "task": {"type": "string"}},
            "required": ["agent", "task"],
        },
    }},
    "required": ["tasks"],
}

MAX_REPO_FILES = 200

PROMPT = """You plan work for three coding agents that share one git repo.
Split the ask below into exactly 3 tasks, one per agent:
- api: backend routes and server logic, files under api/
- web: frontend pages and components, files under web/
- db: the schema, files under db/
Rules:
- Name concrete files from the file list below. Do not invent files when a listed one fits.
- Shared code lives under shared/. Both the api task and the web task must start by editing
  the same shared file their feature needs (for example shared/auth.ts), and each of the two
  tasks must say so by its path. Both edit it unconditionally: never "only if missing", never
  "just import it".
- The db task changes the schema file under db/ (for example db/schema.sql).
- Each task is one or two short imperative sentences the agent can finish in a few minutes.

Tracked files in the repo:
{files}

Ask: {ask}"""

app = FastAPI(title="Bullpen orchestrator")
# The web chat box runs on another port (5173), so the browser needs CORS headers.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
http = httpx.Client()


def env(name: str, default: str) -> str:
    return os.environ.get(name) or default


class OrchestrateIn(BaseModel):
    ask: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AskIn(BaseModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


def valid_tasks(tasks) -> list[dict] | None:
    """Exactly one non-empty task each for api, web, db, returned in that order; else None."""
    if not isinstance(tasks, list) or len(tasks) != 3:
        return None
    by_agent = {}
    for t in tasks:
        if not isinstance(t, dict) or not isinstance(t.get("task"), str) or not t["task"].strip():
            return None
        by_agent[t.get("agent")] = t["task"].strip()
    if set(by_agent) != set(AGENTS):
        return None
    return [{"agent": a, "task": by_agent[a]} for a in AGENTS]


def child_env() -> dict:
    """Drop ANTHROPIC_API_KEY so the CLI always bills the user's subscription."""
    return {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}


def repo_files() -> str:
    """Tracked files of the demo repo, so the planner names real paths. Empty if git fails."""
    demo = env("DEMO_DIR", str(REPO.parent / "demo"))
    try:
        out = subprocess.run(["git", "-C", demo, "ls-files"], capture_output=True, text=True,
                             timeout=5, check=True).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    return "\n".join(out.splitlines()[:MAX_REPO_FILES])


def split_with_claude(ask: str) -> list[dict] | None:
    prompt = PROMPT.format(ask=ask, files=repo_files() or "(unknown)")
    cmd = [env("CLAUDE_BIN", "claude"), "-p", prompt,
           "--output-format", "json", "--json-schema", json.dumps(SCHEMA),
           "--model", "haiku", "--tools", "", "--no-session-persistence",
           "--permission-prompts", "none"]
    try:
        # Own process group, so a timeout kills grandchildren that would hold the pipe open.
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                stdin=subprocess.DEVNULL, text=True, env=child_env(),
                                start_new_session=True)
    except OSError:
        return None
    try:
        out, _ = proc.communicate(timeout=CLI_TIMEOUT)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate()
        return None
    if proc.returncode != 0:
        return None
    try:
        return valid_tasks(json.loads(out)["structured_output"]["tasks"])
    except (ValueError, KeyError, TypeError):
        return None


def canned_tasks() -> list[dict] | None:
    try:
        return valid_tasks(json.loads(CANNED_TASKS.read_text())["tasks"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/orchestrate")
def orchestrate(body: OrchestrateIn):
    tasks, source = split_with_claude(body.ask), "claude"
    if tasks is None:
        tasks, source = canned_tasks(), "canned"
    if tasks is None:
        return error(502, f"Claude could not split the ask and {CANNED_TASKS} is missing or invalid")

    plan = {"ask": body.ask, "tasks": tasks}
    with tempfile.NamedTemporaryFile("w", prefix="bullpen-tasks-", suffix=".json", delete=False) as f:
        json.dump(plan, f)
    start = shlex.split(env("DEMO_START_CMD", str(REPO / "scripts" / "demo_start.sh")))
    try:
        proc = subprocess.run([*start, f.name], capture_output=True, text=True,
                              stdin=subprocess.DEVNULL, timeout=START_TIMEOUT)
    except (OSError, subprocess.TimeoutExpired) as e:
        return error(502, f"Could not start the agents: {e}")
    if proc.returncode != 0:
        return error(502, f"Could not start the agents: {(proc.stderr or proc.stdout).strip()}")

    result = {**plan, "source": source, "started": True}
    try:
        r = http.post(env("SERVER_URL", "http://localhost:8600").rstrip("/") + "/hook",
                      json={"event": "Plan", "agent": "orchestrator", **plan}, timeout=SERVER_TIMEOUT)
        r.raise_for_status()
    except httpx.HTTPError:
        result["plan_posted"] = False
    return result


# One short line per event type (events.md section 4). Types not listed here are skipped.
EVENT_LINES = {
    "check": lambda d: " ".join(filter(None, [d["agent"], d["tool"], d.get("file")]))
                       + f" -> {d['decision']} (rule {d.get('rule', '')}, {d.get('latency_ms', '?')} ms)",
    "approval_needed": lambda d: f"{d['agent']} wants {d['tool']} {d['target']} ({d.get('reason', '')})",
    "approved": lambda d: f"a human approved {d['agent']}'s {d['what']}",
    "denied": lambda d: f"{DENIED.get(d.get('text'), d.get('text'))} {d['agent']}'s {d['what']}",
    "claim_wait": lambda d: f"{d['agent']} waits for {d['file']} held by {d['holder']}",
    "claim_granted": lambda d: f"{d['agent']} holds {d['file']}",
    "claim_released": lambda d: f"{d['agent']} released {d['file']} ({d.get('text', '')})",
    "commit": lambda d: f'{d["agent"]} {d["sha"][:7]} "{d["message"]}" ({", ".join(d.get("files", []))})',
    "undo": lambda d: d["agent"],
    "merge": lambda d: f"{d['agent']} {d.get('intent', '')}".strip(),
    "secret_blocked": lambda d: f"{d['agent']} {d['file']} ({d.get('kind', '')})",
    "plan": lambda d: f'"{d["ask"]}" -> ' + "; ".join(f"{t['agent']}: {t['task']}" for t in d["tasks"]),
}
DENIED = {"human": "a human denied", "timeout": "no human answered in 60 s, so the referee denied"}
MAX_EVENTS = 150


def recent_events() -> list[str]:
    """The server's events log (same machine), rendered one line per event, newest last."""
    path = env("BULLPEN_EVENTS_LOG", str(REPO / "server" / "events.log"))
    try:
        raw = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    lines, asks = [], {}  # asks: approval id -> what was asked and why, named again on approve/deny
    for line in raw:
        try:
            e = json.loads(line)
            d = e["data"]
            if e["type"] == "approval_needed":
                asks[d["id"]] = f"{d['tool']} {d['target']} (it needed approval: {d.get('reason', '')})"
            if e["type"] in ("approved", "denied"):
                d = {**d, "what": asks.get(d.get("id"), "")}
            lines.append(f"{e['type']}: {EVENT_LINES[e['type']](d)}")
        except (ValueError, KeyError, TypeError, AttributeError):
            continue  # bad line, or a type we skip (state, hook, unknown)
    return lines[-MAX_EVENTS:]


def state_summary(state: dict) -> list[str]:
    leases = state.get("leases") or []
    lines = []
    for w in state.get("worktrees") or []:
        held = [lease["file"] for lease in leases if lease.get("agent") == w.get("agent")]
        line = (f'{w.get("agent")}: status {w.get("status")}, building {w.get("building")}, '
                f'task "{w.get("task") or ""}", {len(w.get("commits") or [])} commits')
        lines.append(line + (f", holds {', '.join(held)}" if held else ""))
    for a in state.get("approvals") or []:
        lines.append(f"pending approval: {a.get('agent')} wants {a.get('tool')} {a.get('target')} "
                     f"({a.get('reason', '')})")
    for lease in leases:
        if lease.get("waiters"):
            lines.append(f"lease: {lease.get('file')} held by {lease.get('agent')}, "
                         f"waiting: {', '.join(lease['waiters'])}")
    return lines


def ask_context() -> str:
    """Plain text for the Jetson: recent events, then the current state; newest last, capped."""
    lines = []
    events = recent_events()
    if events:
        lines += ["Recent events, oldest first:", *events]
    try:
        r = http.get(env("SERVER_URL", "http://localhost:8600").rstrip("/") + "/state",
                     timeout=SERVER_TIMEOUT)
        r.raise_for_status()
        summary = state_summary(r.json())
        if summary:
            lines += ["Current state:", *summary]
    except (httpx.HTTPError, ValueError, AttributeError, TypeError, KeyError):
        pass
    kept, size = [], 0
    for line in reversed(lines):  # keep the newest lines that fit
        size += len(line) + 1
        if size > MAX_CONTEXT_CHARS:
            break
        kept.append(line)
    return "\n".join(reversed(kept))


@app.post("/reset")
def reset():
    """Run the demo reset script (worktrees back to main, leases cleared). The server keeps running."""
    cmd = shlex.split(env("DEMO_RESET_CMD", str(REPO / "scripts" / "demo_reset.sh")))
    start = time.monotonic()
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=child_env())
    except (OSError, subprocess.TimeoutExpired) as e:
        return error(502, f"reset failed: {e}")
    if done.returncode != 0:
        return error(502, f"reset exited {done.returncode}: {done.stderr.strip()[-300:]}")
    return {"ok": True, "seconds": round(time.monotonic() - start, 1)}


@app.post("/ask")
def ask(body: AskIn):
    context = ask_context()
    try:
        r = http.post(env("JETSON_URL", "http://192.168.55.1:8700").rstrip("/") + "/ask",
                      json={"question": body.question, "context": context}, timeout=JETSON_TIMEOUT)
        r.raise_for_status()
        answer = r.json()["answer"]
        if not isinstance(answer, str):
            raise ValueError("answer is not a string")
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        return error(503, f"Jetson /ask failed: {e}")
    return {"answer": answer}
