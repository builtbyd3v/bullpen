#!/usr/bin/env python3
"""Baseline without Bullpen: scripted replay of 3 agents on ONE checkout, no leases.

Each edit is read-file, think, write-whole-file-back (how Edit/Write behave when
several agents share a checkout). We replay a fixed interleaving on a scratch
copy of demo-seed/ and count edits whose change is missing at the end.
Not a live agent run. Stdlib only. Usage: python3 scripts/baseline.py
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "demo-seed"
THINK = 2  # ticks between an agent's read and its write of the same file

# The edit sequences the canned prompts (scripts/demo_tasks.json) lead to.
PLAN = {
    "api": ["shared/auth.ts", "api/users.ts", "tests/auth.test.ts", "docs/architecture.md"],
    "web": ["shared/auth.ts", "web/Header.tsx", "web/login.tsx", "docs/architecture.md"],
    "db": ["db/schema.sql", "docs/api.md"],
}


def schedule():
    """(tick, kind, agent, n, file) events; reads at an equal tick go before writes."""
    ev = []
    for agent, files in PLAN.items():
        t = 0
        for n, f in enumerate(files):
            ev.append((t, 0, agent, n, f, "read"))
            ev.append((t + THINK, 1, agent, n, f, "write"))
            t += THINK + 1
    return sorted(ev, key=lambda e: (e[0], e[1], list(PLAN).index(e[2])))


def run():
    work = Path(tempfile.mkdtemp(prefix="bullpen-baseline-"))
    try:
        shutil.copytree(SEED, work, dirs_exist_ok=True)
        seen = {}
        for _, _, agent, n, f, kind in schedule():
            p = work / f
            if kind == "read":
                seen[(agent, n)] = p.read_text()
            else:  # write the full file back from the earlier read
                p.write_text(seen[(agent, n)] + f"// edit {agent}#{n}\n")
        total = sum(len(v) for v in PLAN.values())
        lost = [(a, n, f) for a, fs in PLAN.items() for n, f in enumerate(fs)
                if f"// edit {a}#{n}\n" not in (work / f).read_text()]
        git = subprocess.run(["git", "-C", str(work), "log", "--oneline"],
                             capture_output=True, text=True)
        history = 0 if git.returncode != 0 else len(git.stdout.splitlines())
        return total, lost, history
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    total, lost, history = run()
    for a, n, f in lost:
        print(f"  lost: {a} edit #{n} to {f}")
    print(f"history entries recording these edits: {history}")
    print(f"lost edits: {len(lost)} of {total}")
