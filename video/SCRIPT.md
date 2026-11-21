# Bullpen demo video script (1:30)

- The video is the demo. There is no live demo at judging: in person, Dev shows the site and may click the pre-set prompt chips.
- Every picture is generated or recorded from the app. There are no camera shots.
- 13 slots, 90 s, 1080p30. Slots, lines and timings live in `timeline.json`; change them there, then update this file.
- Voiceover: 176 words, ElevenLabs voice Jessica at speed 1.1. "take" is the length of the current take. A take may run up to the slot length minus 0.3 s.
- Captions are the voiceover text, burned in at the bottom. Labels sit top left. The spoken line names no model; the three model names are on screen in `10-referee`.
- Sound: voice on top, the app's sound effects lowered under it, optional music bed lowest.

## The core problem

Two agents work in separate worktrees on the same code. Each pull request has no conflict with main, but the two conflict with each other. The second merge breaks, and someone redoes the work. Bullpen stops that live: agents take locks on files while they work, so the second agent waits or adapts while the first one works. If two branches still conflict at merge time, the merge aborts cleanly and nothing breaks on main.

## Shot list and voiceover

### Problem, 0:00 to 0:15

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:00-0:06.5 | `01-problem` | Generated: two pixel agents, each in its own worktree box, edit `shared/auth.ts`. Both PRs show "no conflicts with main". Merge 1 lands, merge 2 turns red. Text: "Both PRs passed. Together they broke." | none | Two agents, two worktrees, one file. Both pull requests pass against main. | 4.6 s |
| 0:06.5-0:10 | `02-conflict` | App: PR conflict view: #14 and #15 both clean against main, the overlapping shared/auth.ts lines highlighted | Clean against main. In conflict with each other. | Merge one, and the other breaks. | 1.4 s |
| 0:10-0:15 | `03-title` | Generated: intro B, the bull charges in, "BULLPEN", tagline | none | This is Bullpen. Source control for AI agents. | 2.9 s |

### Live demo, 0:15 to 0:55

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:15-0:22 | `04-ask` | App: one ask typed in the Orchestrator box, three bulls walk onto campus | One ask, three agents | One ask. The orchestrator splits it into three tasks for three Claude Code agents. | 4.8 s |
| 0:22-0:30 | `05-lock` | App: one agent holds shared/auth.ts, the other waits at the door | File lock: shared/auth.ts | Two agents want auth.ts. The first takes a live lock. The second waits at the door. | 5.5 s |
| 0:30-0:39 | `06-deny` | App: db reaches for the schema, the approval card shows, the edit is denied | Referee: db/** is guarded | The database agent reaches for the schema. The referee says no, so the agent changes its plan. | 5.0 s |
| 0:39-0:47 | `07-undo` | App: Undo on web, its commits leave the timeline | Undo one agent | Don't like one agent's work? Undo that agent alone. The others keep working. | 4.9 s |
| 0:47-0:55 | `08-merge` | App: inside api's building, the real diff, then Merge to main and the intent card | Merge through an intent card | Happy with another? Read the real diff, then merge through an intent card. | 4.1 s |

### Technical depth over a feature montage, 0:55 to 1:30

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:55-1:03 | `09-locks` | App: Locks panel close-up | File locks before every edit, 90 s TTL | Under the pixels, everything is real. Agents lock a file before every edit, and each lock expires in ninety seconds. | 6.8 s |
| 1:03-1:12 | `10-referee` | App: Referee log close-up: rule, latency, model per row | On the Jetson: qwen2.5-coder:3b, llama3.2:3b, nomic-embed-text | The referee runs on a Jetson the agents cannot reach. On-device models write the history, and a secret guard scans every diff. | 7.5 s |
| 1:12-1:17 | `11-offline` | App: referee OFFLINE, every edit blocked (cable pulled during the take, or the OFFLINE rows in the referee log) | Referee offline: every edit denied | Unplug it, and every edit is denied. Bullpen fails closed. | 3.1 s |
| 1:17-1:23 | `12-commits` | App: the campus with agents at work and the commit timeline filling | Auto-commit per edit: Bullpen-Agent, Bullpen-Task | Every edit is a commit, tagged with its agent, on your own Claude subscription. | 4.1 s |
| 1:23-1:30 | `13-close` | Generated: the closing card with the tagline | none | Git tracks what changed. Bullpen controls who's allowed to change it. | 3.6 s |

## Read-aloud copy

Two agents, two worktrees, one file. Both pull requests pass against main.

Merge one, and the other breaks.

This is Bullpen. Source control for AI agents.

One ask. The orchestrator splits it into three tasks for three Claude Code agents.

Two agents want auth.ts. The first takes a live lock. The second waits at the door.

The database agent reaches for the schema. The referee says no, so the agent changes its plan.

Don't like one agent's work? Undo that agent alone. The others keep working.

Happy with another? Read the real diff, then merge through an intent card.

Under the pixels, everything is real. Agents lock a file before every edit, and each lock expires in ninety seconds.

The referee runs on a Jetson the agents cannot reach. On-device models write the history, and a secret guard scans every diff.

Unplug it, and every edit is denied. Bullpen fails closed.

Every edit is a commit, tagged with its agent, on your own Claude subscription.

Git tracks what changed. Bullpen controls who's allowed to change it.
