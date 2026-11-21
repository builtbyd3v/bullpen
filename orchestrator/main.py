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

PROMPT = """You plan work for three coding agents that share one git repo.
Split the ask below into exactly 3 tasks, one per agent:
- api: backend routes and server logic, files under api/
- web: frontend pages and components, files under web/
- db: schema and migrations, files under db/
Each task is one short imperative sentence the agent can finish in a few minutes.

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


def split_with_claude(ask: str) -> list[dict] | None:
    cmd = [env("CLAUDE_BIN", "claude"), "-p", PROMPT.format(ask=ask),
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


@app.post("/ask")
def ask(body: AskIn):
    try:
        r = http.get(env("SERVER_URL", "http://localhost:8600").rstrip("/") + "/state",
                     timeout=SERVER_TIMEOUT)
        r.raise_for_status()
        context = json.dumps(r.json())[:MAX_CONTEXT_CHARS]
    except (httpx.HTTPError, ValueError):
        context = ""
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
