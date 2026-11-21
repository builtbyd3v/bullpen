"""Bullpen referee and event hub. FastAPI on port 8600. Contract: ../shared/events.md."""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import gitops
import jetson
from config import (APPROVAL_TIMEOUT, BLOCK_UNMERGED, COLORS, EDIT_TOOLS, EVENTS_LOG, EXTRA_COLORS, HUB,
                    JETSON_URL, MAIN, RELEASE_ON_COMMIT, REPO)
from gitops import GitError
from referee import Referee, building_for, iso

ref = Referee()
clients: set[WebSocket] = set()
send_lock = asyncio.Lock()  # keeps envelopes in order, e.g. undo before its state
locks: dict[str, asyncio.Lock] = {}  # one git write lock per worktree (and one for the main checkout)
background: set[asyncio.Task] = set()


# ---- event hub (events.md section 4) ----

async def send(type_: str, data: dict, *, log: bool = True, replay: bool = False) -> None:
    envelope = {"type": type_, "data": data}
    if replay:
        envelope["replay"] = True
    async with send_lock:
        if log:
            try:
                with EVENTS_LOG.open("a", encoding="utf-8") as f:
                    f.write(json.dumps({"at": time.time(), **envelope}) + "\n")
            except OSError:
                pass
        for ws in list(clients):
            try:
                await ws.send_json(envelope)
            except Exception:
                clients.discard(ws)


async def push_state() -> None:
    await send("state", await build_state())


def spawn(coro) -> None:
    task = asyncio.create_task(coro)
    background.add(task)
    task.add_done_callback(background.discard)


def lock_for(path: Path) -> asyncio.Lock:
    return locks.setdefault(str(path), asyncio.Lock())


# ---- who is calling ----

async def identify(body: dict) -> tuple[str, Path | None]:
    """Agent name and its worktree. Falls back to the worktree that contains cwd."""
    agent = str(body.get("agent") or "unknown")
    try:
        trees = await gitops.worktrees(REPO)
    except (GitError, OSError):
        return agent, None
    if agent in trees:
        return agent, trees[agent]
    cwd = body.get("cwd")
    if cwd:
        here = Path(cwd).resolve()
        for name, path in trees.items():
            if here.is_relative_to(path.resolve()):
                return (name if agent == "unknown" else agent), path
    return agent, None


def repo_file(body: dict, worktree: Path | None) -> str | None:
    """tool_input.file_path made relative to the worktree root, or None (no file, or outside it)."""
    tool_input = body.get("tool_input") or {}
    raw = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not raw or worktree is None:
        return None
    path = Path(raw)
    if not path.is_absolute():
        path = Path(body.get("cwd") or worktree) / path
    try:
        return path.resolve().relative_to(worktree.resolve()).as_posix()
    except ValueError:
        return None


def reply(decision: str, reason: str = "", file: str | None = None, lease=None, holder: str | None = None) -> dict:
    return {"decision": decision, "reason": reason, "file": file,
            "holder": lease.agent if lease else holder,
            "expires_at": iso(lease.expires) if lease else None}


async def sync_agent(agent: str, worktree: Path, why: str) -> bool:
    """Bring main into one agent's branch so its copies are current. True if it is now up to date.

    Skips (False) when the worktree has uncommitted changes or the update would conflict; the branch
    is then left untouched. With the merge guard on, branches never share a changed file, so the
    update is normally conflict-free.
    """
    async with lock_for(worktree):
        try:
            if not await gitops.is_clean(worktree):
                return False
            sha = await gitops.sync_from_main(worktree, MAIN, f"agent/{agent}")
        except GitError as e:
            print(f"[bullpen] sync of {agent} from {MAIN} failed: {e}")
            return False
    if sha:
        await send("sync", {"agent": agent, "sha": sha, "text": why})
    return True


async def merge_guard(agent: str, file: str) -> tuple[str, str | None] | None:
    """Would editing this file now cause a conflict at merge time?

    ("unmerged", other): another agent's branch changed it and is not merged or undone yet.
    ("stale", None): main changed it after this agent's branch started, so this copy is out of date.
    None: safe. Git errors count as safe here: the lease and the policy check still apply.
    """
    try:
        trees = await gitops.worktrees(REPO)
    except (GitError, OSError):
        return None
    others = sorted(a for a in trees if a != agent)
    found = await asyncio.gather(*(gitops.touches(REPO, MAIN, f"agent/{a}", file) for a in others),
                                 return_exceptions=True)
    for other, changed in zip(others, found):
        if changed is True:
            return "unmerged", other
    if agent in trees:
        try:
            if await gitops.touches(REPO, f"agent/{agent}", MAIN, file):
                return "stale", None
        except GitError:
            pass
    return None


# ---- /state (events.md section 5) ----

async def build_state() -> dict:
    try:
        trees = await gitops.worktrees(REPO)
    except (GitError, OSError) as e:
        return {"main": MAIN, "worktrees": [], "approvals": [], "leases": [], "error": str(e)}
    order = sorted(trees, key=lambda a: (list(COLORS).index(a) if a in COLORS else len(COLORS), a))
    summaries = await asyncio.gather(
        *(gitops.branch_summary(REPO, MAIN, f"agent/{a}") for a in order), return_exceptions=True
    )
    worktrees = []
    for i, (agent, summary) in enumerate(zip(order, summaries)):
        changed, ahead, commits = summary if not isinstance(summary, BaseException) else ([], 0, [])
        info = ref.agent(agent)
        worktrees.append({
            "agent": agent,
            "color": COLORS.get(agent, EXTRA_COLORS[i % len(EXTRA_COLORS)]),
            "branch": f"agent/{agent}",
            "path": str(trees[agent]),
            "task": info.task or next((c["task"] for c in commits if c["task"] not in ("", "none")), ""),
            "changed_files": changed,
            "ahead": ahead,
            "claims": ref.claims(agent),
            "status": ref.status(agent),
            "building": info.building,
            "commits": [{"sha": c["sha"], "message": c["message"], "files": c["files"],
                         "at": c["at"], "task": c["task"]} for c in commits],
        })
    return {"main": MAIN, "worktrees": worktrees,
            "approvals": [a.public() for a in ref.approvals.values()],
            "leases": ref.public_leases()}


# ---- background work ----

async def sweep() -> None:
    """Expire leases and stale queue spots every second."""
    while True:
        await asyncio.sleep(1)
        expired = ref.expire()
        for lease in expired:
            await send("claim_released", {"agent": lease.agent, "file": lease.file,
                                          "building": building_for(lease.file), "text": "expired"})
        if expired:
            await push_state()


async def expire_approval(approval_id: str) -> None:
    await asyncio.sleep(APPROVAL_TIMEOUT)
    approval = ref.resolve(approval_id, "timeout")
    if approval:
        await send("denied", {"id": approval.id, "agent": approval.agent, "text": "timeout"})
        await push_state()


async def commit_edit(agent: str, worktree: Path, file: str) -> None:
    """Auto-commit one edit (events.md section 3): scan, message, commit with trailers, release."""
    try:
        async with lock_for(worktree):
            diff = await gitops.stage(worktree, file)
            if not diff.strip():
                return
            scan = await jetson.scan(diff)
            if scan is not None and not scan["ok"]:
                await gitops.unstage(worktree, file)
                kind = next((f.get("kind", "secret") for f in scan.get("findings") or []), "secret")
                ref.notices[agent] = f"Secret guard blocked your edit to {file} ({kind}). Remove it, then retry."
                await send("secret_blocked", {"agent": agent, "file": file, "kind": kind})
                await push_state()
                return
            message = await jetson.commit_msg(diff, agent) or f"Edit {file}"
            task = ref.agent(agent).task
            sha = await gitops.commit(worktree, file, message, agent, task)
    except GitError as e:
        print(f"[bullpen] commit failed for {agent} {file}: {e}")
        return
    await send("commit", {"agent": agent, "sha": sha, "message": message, "files": [file],
                          "task": task, "at": iso(time.time())})
    if RELEASE_ON_COMMIT and ref.release(file, agent):
        await send("claim_released", {"agent": agent, "file": file,
                                      "building": building_for(file), "text": "commit"})
    await push_state()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(sweep())
    yield
    task.cancel()


app = FastAPI(title="Bullpen server", lifespan=lifespan)
# The web app runs on another port (5173), so the browser needs CORS headers.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "repo": str(REPO), "repo_found": (REPO / ".git").exists(), "jetson": JETSON_URL}


# ---- the pre-edit call (events.md section 2) ----

async def ask_human(agent: str, tool: str, target: str, reason: str) -> tuple[bool, str]:
    """Hold the request until a human answers or the approval times out."""
    approval = ref.pending(agent, target)
    if approval is None:
        approval = ref.open_approval(agent, tool, target, reason or "Guarded folder")
        spawn(expire_approval(approval.id))
        await send("approval_needed", approval.public())
        await push_state()
    decision, note = await asyncio.shield(approval.future)
    if decision == "allow":
        return True, ""
    if decision == "timeout":
        return False, f"No human approved {target} within {APPROVAL_TIMEOUT} s. Work on something else."
    return False, f"A human denied {target}." + (f" {note}" if note else "")


async def run_checkout(body: dict) -> dict:
    agent, worktree = await identify(body)
    tool = str(body.get("tool_name") or "")
    file = repo_file(body, worktree) if tool in EDIT_TOOLS else None
    command = (body.get("tool_input") or {}).get("command") if tool == "Bash" else None

    if agent in ref.notices:
        return reply("deny", ref.notices.pop(agent), file)
    if file:
        ref.agent(agent).building = building_for(file)

    check = await jetson.check(agent, tool, file, command)
    await send("check", {"agent": agent, "tool": tool, "file": file, "decision": check["decision"],
                         "rule": check["rule"], "latency_ms": check["latency_ms"],
                         "model": check["model"], "at": iso(time.time())})
    if check["decision"] == "deny":
        return reply("deny", check["reason"] or "Denied by Bullpen policy", file)
    if check["decision"] == "ask":
        target = file or command or tool
        if (agent, target) not in ref.approved:
            allowed, why = await ask_human(agent, tool, target, check["reason"])
            await push_state()
            if not allowed:
                return reply("deny", why, file)

    if not file:  # Bash, or a path outside the worktree: policy only, no lease
        return reply("allow")

    building = building_for(file)
    current = ref.leases.get(file)
    lease_free = current is None or current.expires <= time.time()
    if BLOCK_UNMERGED and lease_free:  # a held lease is answered by the lease below
        blocked = await merge_guard(agent, file)
        if blocked and blocked[0] == "stale" and worktree is not None:
            # Backup for the update after merge: refresh this agent's branch now, then check again.
            if await sync_agent(agent, worktree, "stale"):
                await push_state()
                blocked = await merge_guard(agent, file)
        if blocked and blocked[0] == "unmerged":
            other = blocked[1]
            ref.waiters.setdefault(file, {}).setdefault(agent, time.time())  # shows as waiting
            await send("claim_wait", {"agent": agent, "file": file, "building": building, "holder": other})
            await push_state()
            return reply("wait", f"{file} has unmerged changes on agent/{other}. Two branches must not change "
                                 f"the same file. Work on something else and retry after {other} is merged "
                                 "or undone.", file, holder=other)
        if blocked:
            return reply("deny", f"{file} changed on {MAIN} after your branch started, and your branch could not "
                                 f"be updated from {MAIN} automatically (uncommitted changes or a conflict). Work "
                                 "on other files and retry; a human may need to resolve it.", file)

    granted, lease = ref.claim(file, agent)
    if granted:
        ref.agent(agent).done = False
        await send("claim_granted", {"agent": agent, "file": file, "building": building,
                                     "expires_at": iso(lease.expires)})
        await push_state()
        return reply("allow", "", file, lease)
    await send("claim_wait", {"agent": agent, "file": file, "building": building, "holder": lease.agent})
    await push_state()
    return reply("wait", f"{file} is leased by agent {lease.agent} until {iso(lease.expires)}. "
                         "Work on something else and retry.", file, lease)


@app.post("/checkout")
async def checkout(body: dict):
    await send("hook", body)
    return await run_checkout(body)


# ---- every other hook event (events.md section 3) ----

@app.post("/hook")
async def hook(body: dict):
    await send("hook", body)
    event = body.get("event") or body.get("hook_event_name")

    if event == "Plan":  # from the orchestrator (events.md section 6b)
        tasks = [t for t in body.get("tasks") or [] if isinstance(t, dict) and t.get("agent")]
        for t in tasks:
            ref.agent(str(t["agent"])).task = str(t.get("task") or "")
        await send("plan", {"ask": body.get("ask", ""), "tasks": tasks})
        await push_state()
        return {"decision": "allow", "reason": ""}

    if event == "PreToolUse":
        # Until the hook calls /checkout, answer here. The current hook only understands allow and deny.
        result = await run_checkout(body)
        if result["decision"] != "allow":
            result["decision"] = "deny"
        return result

    agent, worktree = await identify(body)
    if event == "PostToolUse" and body.get("tool_name") in EDIT_TOOLS and worktree is not None:
        file = repo_file(body, worktree)
        if file:
            ref.renew(file, agent)
            spawn(commit_edit(agent, worktree, file))
    elif event == "Stop":
        for lease in ref.release_agent(agent):
            await send("claim_released", {"agent": agent, "file": lease.file,
                                          "building": building_for(lease.file), "text": "stop"})
        await push_state()
    return {"decision": "allow", "reason": ""}


# ---- reads ----

@app.get("/state")
async def state():
    return await build_state()


async def agent_worktree(agent: str) -> Path:
    try:
        trees = await gitops.worktrees(REPO)
    except (GitError, OSError) as e:
        raise HTTPException(503, f"demo repo unavailable: {e}")
    if agent not in trees:
        raise HTTPException(404, f"no worktree for agent {agent}")
    return trees[agent]


@app.get("/diff")
async def diff(agent: str, file: str = ""):
    await agent_worktree(agent)
    return {"diff": await gitops.diff(REPO, MAIN, f"agent/{agent}", file)}


@app.get("/history")
async def history(file: str):
    try:
        commits = await gitops.log(REPO, "--branches", "--", file)
    except GitError as e:
        raise HTTPException(503, str(e))
    return [{"sha": c["sha"], "agent": c["agent"], "task": c["task"], "message": c["message"],
             "at": c["at"]} for c in commits]


# ---- actions from the web (events.md section 6) ----

@app.post("/undo/{agent}")
async def undo(agent: str):
    worktree = await agent_worktree(agent)
    async with lock_for(worktree):
        try:
            await gitops.reset_hard(worktree, MAIN)
        except GitError as e:
            raise HTTPException(500, str(e))
    for lease in ref.release_agent(agent):
        await send("claim_released", {"agent": agent, "file": lease.file,
                                      "building": building_for(lease.file), "text": "undo"})
    ref.forget(agent)
    info = ref.agent(agent)
    info.building, info.done = HUB, False
    await send("undo", {"agent": agent})
    await push_state()
    return {"ok": True}


@app.post("/merge/{agent}")
async def merge(agent: str):
    worktree = await agent_worktree(agent)
    branch = f"agent/{agent}"
    async with lock_for(REPO), lock_for(worktree):
        _, ahead, commits = await gitops.branch_summary(REPO, MAIN, branch)
        if ahead == 0:
            raise HTTPException(409, f"{branch} has nothing to merge")
        branch_diff = await gitops.diff(REPO, MAIN, branch)
        intent = await jetson.summarize(agent, branch, branch_diff[:12000], [c["message"] for c in commits])
        try:
            sha = await gitops.merge(REPO, MAIN, branch, f"Merge {branch}: {intent or ref.agent(agent).task or 'agent work'}"[:200])
        except GitError as e:
            raise HTTPException(409, f"merge failed and was aborted: {e}")
    ref.release_agent(agent)
    info = ref.agent(agent)
    info.building, info.done = HUB, True
    await send("merge", {"agent": agent, "sha": sha, "intent": intent})
    # Keep every branch current, so agents waiting on this agent's files get the new version, not a stale copy.
    try:
        trees = await gitops.worktrees(REPO)
    except (GitError, OSError):
        trees = {}  # the merge already succeeded; a failed update is retried at the agent's next checkout
    synced = [a for a, path in sorted(trees.items()) if await sync_agent(a, path, f"merge {agent}")]
    await push_state()
    return {"ok": True, "sha": sha, "intent": intent, "synced": sorted(synced)}


@app.post("/approve/{approval_id}")
async def approve(approval_id: str, body: dict):
    decision = body.get("decision")
    if decision not in ("allow", "deny"):
        raise HTTPException(422, 'decision must be "allow" or "deny"')
    approval = ref.resolve(approval_id, decision, str(body.get("reason") or ""))
    if approval is None:
        raise HTTPException(404, f"no pending approval {approval_id}")
    if decision == "allow":
        await send("approved", {"id": approval.id, "agent": approval.agent})
    else:
        await send("denied", {"id": approval.id, "agent": approval.agent, "text": "human"})
    await push_state()
    return {"ok": True}


@app.get("/replay")
async def replay():
    """Re-broadcast events.log in order, with gaps capped at 1.5 s. Envelopes carry replay: true."""
    try:
        lines = EVENTS_LOG.read_text(encoding="utf-8").splitlines()
    except OSError:
        raise HTTPException(404, "no events.log yet")
    records = []
    for line in lines:
        try:
            records.append(json.loads(line))
        except ValueError:
            continue

    async def play() -> None:
        previous = None
        for r in records:
            if previous is not None:
                await asyncio.sleep(min(max(r.get("at", previous) - previous, 0), 1.5))
            previous = r.get("at", previous)
            await send(r["type"], r["data"], log=False, replay=True)

    spawn(play())
    return {"ok": True, "events": len(records)}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)
