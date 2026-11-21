# Bullpen demo video script (2:00)

- The video is the demo. There is no live demo at judging: in person, Dev shows the site and may click the pre-set prompt chips.
- Every picture is generated or recorded from the app. There are no camera shots.
- 13 slots, 120 s, 1080p30. Slots, lines and timings live in `timeline.json`; change them there, then update this file.
- Voiceover: 250 words. "take" is the length of the current ElevenLabs take (voice: Jessica, set for more emotion). A take may run up to the slot length minus 0.3 s.
- Captions are the voiceover text, burned in at the bottom. Labels sit top left.
- Sound: voice on top, the app's sound effects from each clip lowered under it, optional music bed lowest.
- The spoken line names no model. The three model names are on screen in slot 12.

## The core problem

Two agents work in separate worktrees on the same code. Each pull request has no conflict with main, but the two conflict with each other. The second merge breaks, and someone redoes the work. Bullpen stops that live: agents take locks on files while they work, so the second agent waits or adapts while the first one works. If two branches still conflict at merge time, the merge aborts cleanly and nothing breaks on main.

## Shot list and voiceover

### Problem, 0:00 to 0:10

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:00-0:10 | `01-problem` | Generated: two pixel agents, each in its own worktree box, edit `shared/auth.ts`. Both PRs show "no conflicts with main". Merge 1 lands, merge 2 turns red, the agents steam. Text: "Both PRs passed. Together they broke." | none | Two agents, two worktrees, one file. Both pull requests pass against main. Merge one, and the other breaks. | 8.4 s |

### Title, 0:10 to 0:15

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:10-0:15 | `02-title` | Generated: the pixel bull charges in from the left with dust, "BULLPEN" lifts in, tagline "Source control for AI agents" | none | This is Bullpen. Source control for AI agents. | 3.1 s |

### Live demo, 0:15 to 1:15

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 0:15-0:25 | `03-ask` | One ask in the chat box, three bulls walk onto campus | One ask, three agents | One ask. The orchestrator splits it into three tasks, and three Claude Code agents walk onto campus, each on its own branch. | 7.8 s |
| 0:25-0:35 | `04-lock` | api holds `shared/auth.ts`, web waits at the door, lease countdown | File lock: shared/auth.ts | Two agents want auth.ts. The first takes a live lock. The second waits at the door until the file is free. | 7.0 s |
| 0:35-0:46 | `05-deny` | db reaches for the schema, the referee log shows the deny row | Referee: db/** is guarded | The database agent reaches for the schema. The referee, a Jetson on the desk, says no. The agent reads the reason and changes its plan. | 8.4 s |
| 0:46-0:55 | `06-undo` | Undo on web, scaffolding collapses, commits leave the timeline | Undo one agent | Don't like what one agent did? Undo that agent alone. Its commits roll back, and the others keep working. | 6.6 s |
| 0:55-1:05 | `07-merge` | Building interior, real diff, Merge, intent card | Merge through an intent card | Happy with another? Open its building, read the real diff, and merge through an intent card that says what changed and why. | 8.4 s |
| 1:05-1:15 | `08-unplug` | The referee goes OFFLINE and blocks every edit (cable pulled during the take, or the OFFLINE rows in the referee log) | Referee offline: every edit denied | Unplug the Jetson, and the referee goes offline. Every edit is denied. Bullpen fails closed. | 6.1 s |

### Technical depth, 1:15 to 2:00

| Time | Slot | Picture | Label on screen | Voiceover | take |
|---|---|---|---|---|---|
| 1:15-1:24 | `09-evidence` | Evidence panel close-up, TTL countdown | File locks before every edit, 90 s TTL | Under the pixels, everything is real. Agents lock a file before each edit, and the lock expires after ninety seconds. | 7.2 s |
| 1:24-1:33 | `10-campus` | Campus built from a second repo, then tagged commits | Auto-commit per edit: Bullpen-Agent, Bullpen-Task | Point Bullpen at any repo and it builds your campus. Each edit becomes a commit, tagged with its agent. | 6.7 s |
| 1:33-1:38 | `11-interior` | Building interior zoom | Your own Claude subscription, no API key | It runs on your own Claude subscription, with no API key. | 3.5 s |
| 1:38-1:49 | `12-referee` | Referee log: rule, latency, model | On the Jetson: qwen2.5-coder:3b, llama3.2:3b, nomic-embed-text | The referee runs on separate hardware the agents cannot reach. Small on-device models write the history, and a secret guard scans each diff. | 8.2 s |
| 1:49-2:00 | `13-close` | Generated: title card with the closing line | none | Bullpen stops two agents from writing the same file at once, and records who changed what. Git tracks what changed. Bullpen controls who's allowed to change it. | 9.2 s |

## Read-aloud copy

Two agents, two worktrees, one file. Both pull requests pass against main. Merge one, and the other breaks.

This is Bullpen. Source control for AI agents.

One ask. The orchestrator splits it into three tasks, and three Claude Code agents walk onto campus, each on its own branch.

Two agents want auth.ts. The first takes a live lock. The second waits at the door until the file is free.

The database agent reaches for the schema. The referee, a Jetson on the desk, says no. The agent reads the reason and changes its plan.

Don't like what one agent did? Undo that agent alone. Its commits roll back, and the others keep working.

Happy with another? Open its building, read the real diff, and merge through an intent card that says what changed and why.

Unplug the Jetson, and the referee goes offline. Every edit is denied. Bullpen fails closed.

Under the pixels, everything is real. Agents lock a file before each edit, and the lock expires after ninety seconds.

Point Bullpen at any repo and it builds your campus. Each edit becomes a commit, tagged with its agent.

It runs on your own Claude subscription, with no API key.

The referee runs on separate hardware the agents cannot reach. Small on-device models write the history, and a secret guard scans each diff.

Bullpen stops two agents from writing the same file at once, and records who changed what. Git tracks what changed. Bullpen controls who's allowed to change it.
