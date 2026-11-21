# Judging talk track (about 3:30)

- Order: Dev intro (30 s), the video (1:30), Caua and Monisha on depth (30 s each), then questions.
- The Jetson is not connected at the table. On the laptop, use fake mode only: `/`, `/campus?fake`, `/prs?fake`.
- The video is the demo. Do not start a live run.
- Have the video open and paused at 0:00, and the three pages open in tabs.

## 1. Dev, intro (30 s)

- We are Dev, Monisha and Caua.
- Bullpen is source control for AI agents.
- Put three coding agents on one repo. Each pull request is clean against main, but they conflict with each other, so the second merge breaks.
- Bullpen stops that while the agents work: file locks, a referee on separate hardware, and undo per agent.
- Here are 90 seconds of it running.

## 2. Play the video (1:30)

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
| What is AI-generated? | We built everything today in this repo with Claude Code. The voice is ElevenLabs. Every model and tool is credited in the README. |
