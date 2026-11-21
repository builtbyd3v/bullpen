# Bullpen demo video script (2:00)

- 13 slots, 120 s, 1080p30. Slots, lines and timings live in `timeline.json`; change them there, then update this file.
- Voiceover: 255 words. "say" is the placeholder voice's time at 150 words per minute, a natural speaking pace. A take may run up to the slot length minus 0.3 s.
- Captions are the voiceover text, burned in at the bottom. Labels sit top left.
- The spoken line names no model. The three model names are on screen in slot 12.
- Slot 13 names Scion, Anthropic's in-house source control system. Source for Q&A: https://www.anthropic.com/engineering/redesigning-source-control

## Shot list and voiceover

### Problem, 0:00 to 0:10

| Time | Slot | Picture | Label on screen | Voiceover | say |
|---|---|---|---|---|---|
| 0:00-0:10 | `01-problem` | Real life: a person at a laptop watches two agents overwrite `auth.ts`, then slumps | none | Three AI agents, one repo. Two of them just rewrote the same file. One version is gone, and nothing recorded it. | 8.2 s |

### Title, 0:10 to 0:15

| Time | Slot | Picture | Label on screen | Voiceover | say |
|---|---|---|---|---|---|
| 0:10-0:15 | `02-title` | Generated: the pixel bull loads in, "BULLPEN", tagline "Source control for AI agents" | none | This is Bullpen. Source control for AI agents. | 3.6 s |

### Live demo, 0:15 to 1:15

| Time | Slot | Picture | Label on screen | Voiceover | say |
|---|---|---|---|---|---|
| 0:15-0:25 | `03-ask` | One ask in the chat box, three bulls walk onto campus | One ask, three agents | One ask. The orchestrator splits it into three tasks, and three Claude Code agents walk onto campus, each on its own branch. | 8.6 s |
| 0:25-0:35 | `04-lock` | api holds `shared/auth.ts`, web waits at the door, lease countdown | File lock: shared/auth.ts | Two agents want auth.ts. The first one takes the lock. The second waits at the door until the file is free. | 6.9 s |
| 0:35-0:46 | `05-deny` | db reaches for the schema, the referee log shows the deny row | Referee: db/** is guarded | The database agent reaches for the schema. The referee, a Jetson on the desk, says no. The agent reads the reason and changes its plan. | 9.2 s |
| 0:46-0:55 | `06-undo` | Undo on web, scaffolding collapses, commits leave the timeline | Undo one agent | Don't like what one agent did? Undo that agent alone. Its commits roll back, and the others keep working. | 6.9 s |
| 0:55-1:05 | `07-merge` | Building interior, real diff, Merge, intent card | Merge through an intent card | Happy with another? Open its building, read the real diff, and merge through an intent card that says what changed and why. | 7.5 s |
| 1:05-1:15 | `08-unplug` | The cable comes out, referee log shows OFFLINE | Jetson unplugged: every edit denied | Now pull the Jetson's cable. The referee is offline, so every edit is denied. Bullpen fails closed. | 7.2 s |

### Technical depth, 1:15 to 2:00

| Time | Slot | Picture | Label on screen | Voiceover | say |
|---|---|---|---|---|---|
| 1:15-1:24 | `09-evidence` | Evidence panel close-up, TTL countdown | File locks before every edit, 90 s TTL | Under the pixels, everything is real. Agents lock a file before each edit, and the lock expires after ninety seconds. | 8.0 s |
| 1:24-1:32 | `10-campus` | Campus built from a second repo, then tagged commits | Auto-commit per edit: Bullpen-Agent, Bullpen-Task | Point Bullpen at any repo and it builds your campus. Each edit becomes a commit, tagged with its agent. | 6.5 s |
| 1:32-1:38 | `11-interior` | Building interior zoom | Your own Claude subscription, no API key | It runs on your own Claude subscription, with no API key. | 4.0 s |
| 1:38-1:48 | `12-referee` | Referee log: rule, latency, model | On the Jetson: qwen2.5-coder:3b, llama3.2:3b, nomic-embed-text | The referee runs on separate hardware the agents cannot reach. Small on-device models write the history, and a secret guard scans each diff. | 8.8 s |
| 1:48-2:00 | `13-close` | Generated: title card with the closing line | none | Anthropic rebuilt source control for agents, and called it Scion. Bullpen brings that to every engineer. Git tracks what changed. Bullpen controls who's allowed to change it. | 11.2 s |

## Read-aloud copy

Three AI agents, one repo. Two of them just rewrote the same file. One version is gone, and nothing recorded it.

This is Bullpen. Source control for AI agents.

One ask. The orchestrator splits it into three tasks, and three Claude Code agents walk onto campus, each on its own branch.

Two agents want auth.ts. The first one takes the lock. The second waits at the door until the file is free.

The database agent reaches for the schema. The referee, a Jetson on the desk, says no. The agent reads the reason and changes its plan.

Don't like what one agent did? Undo that agent alone. Its commits roll back, and the others keep working.

Happy with another? Open its building, read the real diff, and merge through an intent card that says what changed and why.

Now pull the Jetson's cable. The referee is offline, so every edit is denied. Bullpen fails closed.

Under the pixels, everything is real. Agents lock a file before each edit, and the lock expires after ninety seconds.

Point Bullpen at any repo and it builds your campus. Each edit becomes a commit, tagged with its agent.

It runs on your own Claude subscription, with no API key.

The referee runs on separate hardware the agents cannot reach. Small on-device models write the history, and a secret guard scans each diff.

Anthropic rebuilt source control for agents, and called it Scion. Bullpen brings that to every engineer. Git tracks what changed. Bullpen controls who's allowed to change it.
