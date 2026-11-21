# Bullpen — USF Tampa Pixel Campus Design Prototype

Standalone interactive pixel-art frontend design for **Bullpen**, modeled exclusively on the USF Tampa Campus Greenway map and styled with the official USF brand color palette (`#006747` USF Green & `#CFC493` USF Gold).

## Quick Preview

Open `design/index.html` directly in any browser (no build step required), or serve this folder locally:

```sh
npx serve design
```

## Included Design Features

- **USF Tampa Campus Greenway Pixel Map**: Faithful pixel-art layout with E Fletcher Ave, E Fowler Ave, Bruce B Downs Blvd, N 50th St, diagonal-hatched Greenway corridors, campus ponds, USF Health, USF Athletics venues, and interactive folder buildings (`ENB`, `MSC`, `LIB`, `SUN`, `BSN`, `ISA`, `REC`, `FAH`).
- **Claude Model Bull Mascots**: Distinct USF-harmonized colors per Claude model (`Opus 4.6`, `Sonnet 4.6`, `Haiku 4.5`) with idle campus patrolling, road pathfinding to buildings, and hovering work animation.
- **Building Interactions**: Hover for mapped folder path, timer, and queue count; click to open the Folder Change Inspector with summaries, queued agents, and file-by-file diffs.
- **Door Waiting Queue & Handoff**: When a building is occupied, arriving agents wait in line outside the door (impatient foot-tap, animated pixel hourglass, `WAIT #1` queue badge) and automatically enter once the building opens up.
- **Construction & Ribbon-Cutting FX**: Active buildings display traffic cones, scaffolding, hazard tape, sparks, and an animated crane; normal completion triggers a ceremonial ribbon-cutting transition with golden scissors, USF confetti, and a completion banner before admitting the next waiting agent.
- **Dramatic Kick-Out Animation (Error / Time Limit)**: If an active agent hits an error or exceeds the configurable lease time limit, a dramatic 3-beat eviction animation plays (giant pixel boot, airborne tumbling Bull with smoke trail, ground `THUD!` bounce, and alert banner) and the waiting agent at the door immediately enters the building.
- **Options Menu & Dual Representation**: Edit the root folder path, configure the agent lease time limit (seconds), remap any building to a custom folder path (with Guarded Zone toggles), and toggle seamlessly between the **Pixel Art USF Campus** and **Traditional Workflow Representation**.
- **The Oracle Feed**: Live USF campus newspaper-styled commit, lease, queue, eviction, and ribbon-cutting feed.
