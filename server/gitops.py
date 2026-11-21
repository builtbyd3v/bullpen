"""Git plumbing for the referee. Every call runs in a thread so the event loop never blocks."""

import asyncio
import subprocess
from pathlib import Path

US, RS = "\x1f", "\x1e"  # unit and record separators for git log parsing
LOG_FORMAT = (
    "%x1e%h%x1f%s%x1f%aI"
    "%x1f%(trailers:key=Bullpen-Agent,valueonly,separator=%x2C)"
    "%x1f%(trailers:key=Bullpen-Task,valueonly,separator=%x2C)"
)
# The committer is Bullpen; the author is the agent (set per commit).
IDENTITY = ["-c", "user.name=Bullpen", "-c", "user.email=bullpen@bullpen.local"]


class GitError(RuntimeError):
    pass


def _run(cwd: Path, args: list[str], check: bool) -> str:
    p = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if check and p.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {(p.stderr or p.stdout).strip()}")
    return p.stdout


async def git(cwd: Path, *args: str, check: bool = True) -> str:
    return await asyncio.to_thread(_run, cwd, list(args), check)


async def worktrees(repo: Path) -> dict[str, Path]:
    """Agent name -> worktree path, for every worktree on a branch named agent/<name>."""
    out = await git(repo, "worktree", "list", "--porcelain")
    found: dict[str, Path] = {}
    path = None
    for line in out.splitlines():
        if line.startswith("worktree "):
            path = Path(line[len("worktree "):])
        elif line.startswith("branch refs/heads/agent/") and path is not None:
            found[line[len("branch refs/heads/agent/"):]] = path
    return found


async def log(cwd: Path, *args: str) -> list[dict]:
    """Commits, newest first: {sha, message, at, agent, task, files}."""
    out = await git(cwd, "log", f"--format={LOG_FORMAT}", "--name-only", *args)
    commits = []
    for record in out.split(RS)[1:]:
        head, _, files = record.partition("\n")
        sha, message, at, agent, task = (head.split(US) + [""] * 5)[:5]
        commits.append({
            "sha": sha, "message": message, "at": at, "agent": agent.strip(), "task": task.strip(),
            "files": [f for f in files.splitlines() if f.strip()],
        })
    return commits


async def branch_summary(repo: Path, main: str, branch: str) -> tuple[list[str], int, list[dict]]:
    """changed_files, ahead, commits for one agent branch (events.md section 5)."""
    changed, ahead, commits = await asyncio.gather(
        git(repo, "diff", "--name-only", f"{main}...{branch}"),
        git(repo, "rev-list", "--count", f"{main}..{branch}"),
        log(repo, f"{main}..{branch}"),
    )
    return [f for f in changed.splitlines() if f], int(ahead.strip() or 0), commits


async def stage(worktree: Path, file: str) -> str:
    """Stage one file (including a delete) and return its staged diff ("" if unchanged)."""
    await git(worktree, "add", "-A", "--", file)
    return await git(worktree, "diff", "--cached", "--", file)


async def unstage(worktree: Path, file: str) -> None:
    await git(worktree, "reset", "-q", "--", file, check=False)


async def commit(worktree: Path, file: str, message: str, agent: str, task: str) -> str:
    """Commit only this file, with the Bullpen trailers. Returns the short sha."""
    task = " ".join(task.split()) or "none"
    trailers = f"Bullpen-Agent: {agent}\nBullpen-Task: {task}"
    await git(
        worktree, *IDENTITY, "commit", "-q", f"--author=agent {agent} <{agent}@bullpen.local>",
        "-m", message, "-m", trailers, "--", file,
    )
    return (await git(worktree, "rev-parse", "--short", "HEAD")).strip()


async def reset_hard(worktree: Path, main: str) -> None:
    await git(worktree, "reset", "-q", "--hard", main)


async def merge(repo: Path, main: str, branch: str, message: str) -> str:
    """Merge branch into main in the repo's main checkout. Aborts and raises on conflict."""
    current = (await git(repo, "rev-parse", "--abbrev-ref", "HEAD")).strip()
    if current != main:
        raise GitError(f"{repo} has {current} checked out, not {main}")
    try:
        await git(repo, *IDENTITY, "merge", "--no-ff", "-m", message, branch)
    except GitError:
        await git(repo, "merge", "--abort", check=False)
        raise
    return (await git(repo, "rev-parse", "--short", "HEAD")).strip()


async def diff(repo: Path, main: str, branch: str, path: str = "") -> str:
    return await git(repo, "diff", f"{main}...{branch}", *(["--", path] if path else []))
