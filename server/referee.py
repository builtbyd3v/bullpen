"""In-memory referee state: file leases, wait queues, approvals, and what each agent is doing.

Plain code, no AI: every decision here is deterministic. Contract: ../shared/events.md.
"""

import asyncio
import itertools
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from config import APPROVAL_TIMEOUT, CAMPUS_FILE, HUB, LEASE_TTL


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# ---- campus: file -> building (events.md "Campus layout") ----

_campus: dict = {"mtime": None, "buildings": []}


def _buildings() -> list[dict]:
    try:
        mtime = CAMPUS_FILE.stat().st_mtime
        if mtime != _campus["mtime"]:
            _campus["buildings"] = json.loads(CAMPUS_FILE.read_text(encoding="utf-8"))["buildings"]
            _campus["mtime"] = mtime
    except (OSError, ValueError, KeyError):
        pass
    return _campus["buildings"]


def building_for(file: str) -> str:
    """Longest non-empty folder prefix; root files -> the hub; no match -> the annex."""
    buildings = _buildings()
    best = max(
        (b for b in buildings if b.get("folder") and file.startswith(b["folder"])),
        key=lambda b: len(b["folder"]), default=None,
    )
    if best:
        return best["id"]
    if "/" not in file:
        return next((b["id"] for b in buildings if b.get("folder") == ""), HUB)
    return next((b["id"] for b in buildings if "folder" in b and b["folder"] is None), "juniper")


# ---- referee state ----

@dataclass
class Lease:
    file: str
    agent: str
    expires: float


@dataclass
class Approval:
    id: str
    agent: str
    tool: str
    target: str
    reason: str
    expires: float
    future: asyncio.Future

    def public(self) -> dict:
        return {"id": self.id, "agent": self.agent, "tool": self.tool, "target": self.target,
                "reason": self.reason, "expires_at": iso(self.expires)}


@dataclass
class Agent:
    task: str = ""
    building: str = HUB
    done: bool = False  # set by merge, cleared by the agent's next edit


@dataclass
class Referee:
    leases: dict[str, Lease] = field(default_factory=dict)
    waiters: dict[str, dict[str, float]] = field(default_factory=dict)  # file -> {agent: since}, oldest first
    approvals: dict[str, Approval] = field(default_factory=dict)
    approved: set[tuple[str, str]] = field(default_factory=set)  # (agent, target) a human already allowed
    notices: dict[str, str] = field(default_factory=dict)  # agent -> deny reason for its next /checkout
    agents: dict[str, Agent] = field(default_factory=dict)
    _ids: itertools.count = field(default_factory=lambda: itertools.count(1))

    def agent(self, name: str) -> Agent:
        return self.agents.setdefault(name, Agent())

    # -- leases --

    def claim(self, file: str, agent: str) -> tuple[bool, Lease]:
        """Grant or renew if free, expired, or already ours. Otherwise join the wait queue."""
        now = time.time()
        lease = self.leases.get(file)
        if lease is None or lease.expires <= now or lease.agent == agent:
            lease = self.leases[file] = Lease(file, agent, now + LEASE_TTL)
            self.waiters.get(file, {}).pop(agent, None)
            return True, lease
        self.waiters.setdefault(file, {}).setdefault(agent, now)
        return False, lease

    def renew(self, file: str, agent: str) -> bool:
        lease = self.leases.get(file)
        if lease and lease.agent == agent:
            lease.expires = time.time() + LEASE_TTL
            return True
        return False

    def release(self, file: str, agent: str) -> Lease | None:
        lease = self.leases.get(file)
        if lease and lease.agent == agent:
            return self.leases.pop(file)
        return None

    def release_agent(self, agent: str) -> list[Lease]:
        """Drop every lease and queue spot this agent has."""
        released = [self.leases.pop(f) for f, lease in list(self.leases.items()) if lease.agent == agent]
        for queue in self.waiters.values():
            queue.pop(agent, None)
        return released

    def expire(self) -> list[Lease]:
        now = time.time()
        expired = [self.leases.pop(f) for f, lease in list(self.leases.items()) if lease.expires <= now]
        for file, queue in list(self.waiters.items()):
            for agent, since in list(queue.items()):
                if since + LEASE_TTL <= now:
                    del queue[agent]
            if not queue:
                del self.waiters[file]
        return expired

    # -- approvals --

    def pending(self, agent: str, target: str) -> Approval | None:
        return next((a for a in self.approvals.values() if a.agent == agent and a.target == target), None)

    def open_approval(self, agent: str, tool: str, target: str, reason: str) -> Approval:
        approval = Approval(f"ap{next(self._ids)}", agent, tool, target, reason,
                            time.time() + APPROVAL_TIMEOUT, asyncio.get_running_loop().create_future())
        self.approvals[approval.id] = approval
        return approval

    def resolve(self, approval_id: str, decision: str, note: str = "") -> Approval | None:
        """decision: allow | deny | timeout. Wakes every held /checkout waiting on it."""
        approval = self.approvals.pop(approval_id, None)
        if approval is None:
            return None
        if decision == "allow":
            self.approved.add((approval.agent, approval.target))
        if not approval.future.done():
            approval.future.set_result((decision, note))
        return approval

    # -- per-agent view for /state --

    def status(self, agent: str) -> str:
        if any(a.agent == agent for a in self.approvals.values()):
            return "blocked"
        if any(agent in queue for queue in self.waiters.values()):
            return "waiting"
        return "done" if self.agent(agent).done else "working"

    def claims(self, agent: str) -> list[str]:
        return sorted({building_for(lease.file) for lease in self.leases.values() if lease.agent == agent})

    def forget(self, agent: str) -> None:
        """After undo: approvals and notices no longer apply."""
        self.approved = {pair for pair in self.approved if pair[0] != agent}
        self.notices.pop(agent, None)

    def public_leases(self) -> list[dict]:
        return [{"file": lease.file, "agent": lease.agent, "expires_at": iso(lease.expires),
                 "waiters": list(self.waiters.get(lease.file, {}))}
                for lease in sorted(self.leases.values(), key=lambda lease: lease.file)]
