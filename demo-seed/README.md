# Tasks app (Bullpen demo seed)

A tiny todo service with a login. No install step, no real secrets: files are plain TypeScript and SQL for the agents to edit.

- `api/`: HTTP handlers (users, tasks, router)
- `web/`: UI pages and components
- `db/`: schema (guarded: agents may not edit it directly)
- `shared/`: code both sides import, including `auth.ts`
- `docs/`, `tests/`, `config/`, `scripts/`: the rest
