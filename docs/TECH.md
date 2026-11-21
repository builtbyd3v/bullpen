# Bullpen: judge Q&A cheat sheet

- Bullpen is version control for AI agents: a referee between Claude Code and the repo.
- Every edit goes hook -> server `/checkout` -> Jetson `/check` -> file lease -> edit -> auto-commit.
- Fail closed: no referee answer means no edit.
- Each claim below names the file that implements it.

**What is AI-generated, what we wrote**
Claude Code wrote most of the code, docs and tests under our direction. We set the product, the architecture, the contract (`shared/events.md`), the referee rules, the work split and the demo, and we reviewed and tested what it produced. Full list: README, "Credits".

**What we built vs. what we use**
Claude Code is the agent being controlled, not our product. We built the layer around it: the hook (`hooks/bullpen_hook.py`), the server (`server/`), the Jetson referee (`jetson/main.py`), the orchestrator (`orchestrator/main.py`) and the campus view (`web/`).

**Why a Jetson**
The rules run on separate hardware that the agents cannot reach or edit, so an agent cannot talk its way past them. Commit messages, intent summaries and ask-why run on local models there (`jetson/main.py`), so they cost no Claude usage and no code leaves the room.

**Lease design** (`server/referee.py`)
- One lease per file, TTL 90 s (`BULLPEN_LEASE_TTL`, `server/config.py`). The holder renews it on each edit it reports (`PostToolUse`, `server/main.py`).
- A second agent gets `wait` with the holder and expiry, and joins the file's wait queue. The queue is visible in the UI; the next agent to retry after the lease frees gets it. A queue spot expires after one TTL.
- Release: on Stop, on undo, on merge, on expiry (swept every second), and on commit unless `BULLPEN_RELEASE_ON_COMMIT=0`.
- Why `=0` for the demo: an auto-commit lands in about 1 s, so the lease would drop before the second agent asks, and the collision would not show. With `=0` the lease holds until Stop, undo or expiry.

**No merge conflicts on a file** (`server/main.py` `merge_guard`, `sync_agent`)
- Why: with AI writing most of the code, a merge conflict means untangling two sets of machine-written changes. AI review of that is unreliable and human review of that much code is impractical, so Bullpen stops the conflict before it is written.
- Merge guard: when a file's lease is free, the server also refuses it if another agent's unmerged branch already changed it (`git diff main...agent/<other> -- <file>`). The answer is `wait` with that agent as holder. Leases stop two agents editing a file at the same time; the guard stops two branches changing it before one is merged. On by default (`BULLPEN_BLOCK_UNMERGED`, `server/config.py`).
- Branches stay current: after every merge the server brings `main` into each agent branch (a `sync` event; a fast-forward if the branch has no commits of its own, else a `Sync main into agent/<name>` merge commit). The agent that was waiting gets the new version on its next try and keeps all its own work. Because no two branches share a changed file, this update does not conflict.
- Backup: an agent whose copy is still stale at checkout (`git diff agent/<agent>...main -- <file>`) is updated right then. The server never touches uncommitted work and aborts cleanly on a conflict; only then is the edit denied, with the reason.
- Proven end to end in `server/tests/test_api.py` (`MergeGuardTests`): api changes a file, web waits, api is merged, web is updated, web edits the same file, and web's merge has no conflict.

**Guarded folders** (`jetson/main.py` `/check`)
A file under `db/` (or a Bash command that names it and is not provably read-only) returns `ask`. The server holds the request and shows an approval card. No answer in 60 s means deny (`server/main.py` `ask_human`). A human "allow" holds for that agent and file until the agent is undone.

**Fail-closed paths**
- Hook: server unreachable, timeout (70 s), bad reply or unknown decision -> deny (`hooks/bullpen_hook.py` `checkout`).
- Server: Jetson down or bad `/check` reply -> deny with rule `offline` (`server/jetson.py` `check`). The referee log shows OFFLINE.
- Approval timeout -> deny.
- Only `/check` fails closed. If `/scan` or `/commit_msg` is down, the commit still happens with the message `Edit <file>`.

**Secret guard** (`jetson/main.py` `/scan`, `server/main.py` `commit_edit`)
Regex rules on the added lines of each diff, before the commit: AWS, GitHub, Anthropic, OpenAI and Slack keys, private keys, `.env` values and long quoted secrets. A finding unstages the edit, sends `secret_blocked`, and denies the agent's next tool call with the reason. The secret value is never returned.

**Auto-commit and per-agent undo** (`server/gitops.py`, `server/main.py`)
Each edit is its own commit in the agent's worktree: author `agent <name>`, message from the Jetson, trailers `Bullpen-Agent` and `Bullpen-Task`. One git lock per worktree, so parallel edits never collide on `index.lock`. Undo runs `git reset --hard main` in that agent's worktree and releases its leases. Other agents are not touched.

**Merge with intent** (`server/main.py` `merge`)
The Jetson `/summarize` reads the branch diff and commit messages and writes a 2-sentence intent. The server merges `agent/<name>` into `main` with `--no-ff` and the intent in the merge message, then syncs the other agent branches (see above). With the merge guard a same-file conflict cannot arise; if one still does (for example a file changed by a shell command, outside Bullpen), the merge aborts and returns 409, so `main` stays clean.

**Ask why** (`orchestrator/main.py` `ask_context`)
The context is plain text: recent checks, approvals, denials, waits and commits from the server's `events.log`, then a summary of `/state`, capped to the newest lines that fit. The Jetson ranks long context by embedding similarity (nomic-embed-text) and llama3.2:3b answers in 2 sentences.

**10 agents, and the limits**
- The server finds agents from `git worktree list` (branch `agent/<name>`) so more worktrees work; colors repeat after 7 agents (`server/config.py`). `make_demo.sh` and the orchestrator split create exactly 3.
- `/check` is rules only, so it scales with requests, not with model speed. Local model calls share one 8 GB Jetson.
- Leases and approvals live in memory in one server process. A server restart drops them. Leases and the merge guard are per file, so two agents can still make edits that conflict in meaning across different files (one renames a function, the other calls the old name); git does not catch that either.
- Edits made through shell commands (`sed`, `echo >`) skip the lease and the auto-commit; only the Jetson policy check sees the command.
- Testing: 119 server tests (`server/tests/`) plus Jetson, orchestrator and web tests.

**What we would build next**
Persistent lease state and a FIFO grant for the wait queue. Semantic conflict checks across files before merge.
