# Baseline: 3 agents, one checkout, no Bullpen

- **Number: `lost edits: 2 of 10`**, with 0 history entries recording any of them.
- The pitch line: "Without Bullpen, 2 of 10 agent edits were silently overwritten, and git has no record of them."

## Method (honest version)
This is a **scripted replay of the interleaving**, not a live agent run. No model is called, so it is deterministic and free.

`scripts/baseline.py` copies `demo-seed/` to a scratch directory (not a git repo) and replays the edit sequences the three canned prompts (`scripts/demo_tasks.json`) lead to. Each edit does what the Edit and Write tools do: read the file, think for 2 ticks, write the whole file back. Agents run in parallel, one tick apart per step. An edit counts as lost when its change is missing from the final file.

| Agent | Edit order |
|---|---|
| api | `shared/auth.ts`, `api/users.ts`, `tests/auth.test.ts`, `docs/architecture.md` |
| web | `shared/auth.ts`, `web/Header.tsx`, `web/login.tsx`, `docs/architecture.md` |
| db | `db/schema.sql`, `docs/api.md` |

Result: web's write of `shared/auth.ts` replaces api's (api read the same version first), and web's write of `docs/architecture.md` replaces api's the same way. The scratch directory has no commits, so nothing records either lost edit.

## Reproduce
```
python3 scripts/baseline.py
```
Last line: `lost edits: 2 of 10`. The number moves only if `PLAN` or the seed files in the script change.

## Limit
Real agents vary their order and timing, so a live run may lose more or fewer edits. The replay shows the failure mode, with a fixed and repeatable count.
