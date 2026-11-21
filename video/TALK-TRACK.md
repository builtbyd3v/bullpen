# Judging talk track (3:00, then 1:00 of questions)

- Pitch, 3:00 total: Dev intro 0:00 to 0:48, the video 0:48 to 2:00, Caua 2:00 to 2:30, Monisha 2:30 to 3:00.
- Then 1:00 of questions with one judge.
- The video is 1:12. It is the demo. Do not start a live run.
- The Jetson is not connected at the table. On the laptop, use fake mode only: `/`, `/campus?fake`, `/prs?fake`.
- Have the video open and paused at 0:00, and the three pages open in tabs.

## 1. Dev, intro (48 s)

- We are Dev, Monisha and Caua.
- Bullpen is source control for AI agents.
- Put three coding agents on one repo. Each pull request is clean against main, but they conflict with each other, so the second merge breaks.
- Bullpen stops that while the agents work: file locks, a referee on separate hardware, and undo per agent.
- Git finds that conflict at merge. Bullpen decides before the edit.
- Here are 72 seconds of it running.

## 2. Play the video (1:12)

- 0:00 the problem, 0:15 the fix in Bullpen, 0:50 why it is different, 1:07 the one-liner.

## 3. Caua, frontend (30 s). On screen: `/campus?fake`, then `/prs?fake`

- The campus is Phaser. Each building is a top-level folder of the repo, and a script builds the map from any repo.
- Every animation is one real event: a bull walks to the building of the file it edits, a WAIT flag is the lock queue, each sound is one event.
- Click "Pull requests": two branches, both clean against main, with the overlapping lines of `shared/auth.ts` highlighted.
- Next.js, React and Tailwind, in the dark design we drew today.

## 4. Monisha, backend (30 s). Point at the Jetson

- Every edit goes through a hook to our server before it happens. The server gives a file lock for 90 seconds, renewed by the holder.
- The merge guard refuses a file that another agent's unmerged branch already changed. Two branches never change the same file before one merges.
- This Jetson is the referee: the rules, plus small on-device models for commit messages, summaries and ask-why, and a secret guard on every diff.
- If the server cannot reach it, every edit is denied. It fails closed.
- The agents are Claude Code on a Claude subscription, one git worktree each, one commit per edit, tagged with the agent.

## 5. Likely questions

| Question | Answer |
|---|---|
| How is this different from git worktrees or branch protection? | Worktrees isolate agents but do not coordinate them. Git finds the conflict at merge; Bullpen decides before the edit. |
| Why a Jetson, and not rules on the laptop? | The rules sit on hardware the agents cannot reach or edit, and the local models make the history free and private. |
| Is the video real? | Yes: one automated take of the real stack on this laptop with the Jetson attached. Only the pull-request conflict screen uses scripted data, because the merge guard prevents that state on the real server. For the offline beat we paused the referee service; the denied edits are real. |
| What is AI-generated? | We built everything today in this repo: Dev and Monisha with Claude Code, Caua the web app and design with Antigravity. The voice is ElevenLabs. Every model and tool is credited in the README. |
