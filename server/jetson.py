"""Client for Dev's Jetson service (events.md section 7). The server itself calls no model.

Standard library only, run in a thread, so the server needs no extra dependency.
"""

import asyncio
import json
import time
import urllib.request

from config import JETSON_URL


def _post(path: str, body: dict, timeout: float) -> dict:
    req = urllib.request.Request(
        JETSON_URL + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


async def _call(path: str, body: dict, timeout: float) -> dict | None:
    try:
        return await asyncio.to_thread(_post, path, body, timeout)
    except Exception:
        return None


async def check(agent: str, tool: str, file: str | None, command: str | None) -> dict:
    """Policy check. Fails closed: Jetson down or a bad reply means deny."""
    body = {"agent": agent, "tool_name": tool}
    if file:
        body["file"] = file
    if command:
        body["command"] = command
    start = time.perf_counter()
    reply = await _call("/check", body, timeout=5)
    latency_ms = round((time.perf_counter() - start) * 1000)
    if not reply or reply.get("decision") not in ("allow", "ask", "deny"):
        return {"decision": "deny", "reason": "Bullpen policy offline", "rule": "offline",
                "model": "", "latency_ms": latency_ms}
    return {"decision": reply["decision"], "reason": str(reply.get("reason") or ""),
            "rule": str(reply.get("rule") or "default"), "model": str(reply.get("model") or "rules"),
            "latency_ms": latency_ms}


async def commit_msg(diff: str, agent: str) -> str | None:
    reply = await _call("/commit_msg", {"diff": diff, "agent": agent}, timeout=25)
    message = str((reply or {}).get("message") or "").strip().splitlines()
    return message[0][:72] if message else None


async def scan(diff: str) -> dict | None:
    """Secret guard. None means the Jetson could not answer (callers fall back, events.md section 7)."""
    reply = await _call("/scan", {"diff": diff}, timeout=5)
    return reply if reply and isinstance(reply.get("ok"), bool) else None


async def summarize(agent: str, branch: str, diff: str, commits: list[str]) -> str:
    reply = await _call(
        "/summarize", {"agent": agent, "branch": branch, "diff": diff, "commits": commits}, timeout=25
    )
    return str((reply or {}).get("intent") or "").strip()
