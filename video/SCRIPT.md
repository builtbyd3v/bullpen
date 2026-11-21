# Bullpen demo video script (1:12)

- The video is the demo. There is no live demo at judging.
- 18 shots, 72.1 s, 1080p30. One voice sentence and one close-up per shot. Each shot lasts as long as its line plus a short hold (`fit` and `pad` in `timeline.json`).
- Voiceover: 184 words, ElevenLabs voice Jessica at speed 1.2. Regenerate with `node scripts/voice.mjs make`.
- Footage: one automated take of the real stack (`take-live`), and the pull-request conflict view from `?fake` data (`take-conflict`).
- Captions are the voiceover text, burned in at the bottom. Labels sit top left.

## The core problem

Two agents work in separate worktrees on the same code. Each pull request has no conflict with main, but the two conflict with each other, and git only finds out at merge. Bullpen decides before the edit: file locks while agents work, a merge guard that refuses a file another unmerged branch already changed, and a referee on separate hardware.

## Shot list and voiceover

### Problem, 0:00.0 to 0:14.5

| Time | Slot | Picture | Voiceover |
|---|---|---|---|
| 0:00.0 | `01-clash` | Generated: two pixel agents in worktree boxes edit `shared/auth.ts`, both PRs green, merge 2 turns red, the agents steam | Two AI agents, two branches. Both pull requests are green against main. Merge one, and the other breaks. |
| 0:06.6 | `02-lines` | App close-up: Both rewrite the same lines of shared/auth.ts | Here is why. Both rewrite the same lines of auth.ts. |
| 0:12.0 | `03-merge-breaks` | App close-up: Git only finds out at merge | And git only finds out at merge. |

### The fix, 0:14.5 to 0:49.6

| Time | Slot | Picture | Voiceover |
|---|---|---|---|
| 0:14.5 | `04-title` | Generated: intro bull charges in, BULLPEN | Bullpen stops it before it happens. |
| 0:17.7 | `05-ask` | App close-up: One ask | You type one ask. |
| 0:20.1 | `06-agents` | App close-up: Three agents, three branches | Three Claude Code agents start work, each on its own branch. |
| 0:24.0 | `07-wait` | App close-up: File lock: shared/auth.ts | Two of them want the same file. One gets the lock. |
| 0:27.7 | `08-queue` | App close-up: Lock queue: the other agent waits | The other waits in line, so nothing is overwritten. |
| 0:31.1 | `09-approval` | App close-up: Guarded folder: a human approves | A guarded folder needs a human. Bullpen shows an approval card. |
| 0:34.9 | `10-deny` | App close-up: Denied | Deny it, and the agent writes a plan instead. |
| 0:37.9 | `11-undo` | App close-up: Undo one agent | Don't like one agent's work? Undo that agent. Only its branch rolls back. |
| 0:43.0 | `12-merge` | App close-up: Merge to main | Happy with another? Merge it to main. |
| 0:46.5 | `13-sync` | App close-up: The other branches sync with main | The other branches sync with it at once. |

### Why it is different, 0:49.6 to 1:06.7

| Time | Slot | Picture | Voiceover |
|---|---|---|---|
| 0:49.6 | `14-referee` | App close-up: Referee on a Jetson, with on-device models | Every edit is checked by a referee, on separate hardware the agents can't touch. |
| 0:54.2 | `15-offline` | App close-up: Referee paused: every edit denied | Pause the referee, and every edit is denied. It fails closed. |
| 0:58.6 | `16-trailers` | App close-up: Every commit names its agent | And every edit is a commit, tagged with the agent that made it. |
| 1:02.4 | `17-why` | App close-up: Decided before the edit, not at merge | Git finds the conflict at merge. Bullpen decides before the edit. |

### Close, 1:06.7 to 1:12.1

| Time | Slot | Picture | Voiceover |
|---|---|---|---|
| 1:06.7 | `18-end` | Generated: end card, bull and the one-liner | Git tracks what changed. Bullpen controls who's allowed to change it. |

## Read-aloud copy

Two AI agents, two branches. Both pull requests are green against main. Merge one, and the other breaks.

Here is why. Both rewrite the same lines of auth.ts.

And git only finds out at merge.

Bullpen stops it before it happens.

You type one ask.

Three Claude Code agents start work, each on its own branch.

Two of them want the same file. One gets the lock.

The other waits in line, so nothing is overwritten.

A guarded folder needs a human. Bullpen shows an approval card.

Deny it, and the agent writes a plan instead.

Don't like one agent's work? Undo that agent. Only its branch rolls back.

Happy with another? Merge it to main.

The other branches sync with it at once.

Every edit is checked by a referee, on separate hardware the agents can't touch.

Pause the referee, and every edit is denied. It fails closed.

And every edit is a commit, tagged with the agent that made it.

Git finds the conflict at merge. Bullpen decides before the edit.

Git tracks what changed. Bullpen controls who's allowed to change it.
