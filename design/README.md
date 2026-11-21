# Bullpen — USF Tampa Pixel Campus Design Prototype

Standalone interactive pixel-art frontend design for **Bullpen**, modeled exclusively on the USF Tampa Campus Greenway map and styled with the official USF brand color palette (`#006747` USF Green & `#CFC493` USF Gold).

## Quick Preview

Open `design/index.html` directly in any browser (no build step required), or serve this folder locally:

```sh
npx serve design
```

## Included Design Features

- **USF Tampa Campus Greenway Pixel Map**: Fidelty layout with E Fletcher Ave, E Fowler Ave, Bruce B Downs Blvd, N 50th St, diagonal-hatched Greenway corridors, campus ponds, USF Health, USF Athletics venues, and interactive folder buildings (`ENB`, `MSC`, `LIB`, `SUN`, `BSN`, `ISA`, `REC`, `FAH`).
- **Claude Model Bull Mascots**: Distinct USF-harmonized colors per Claude model (`Opus 4.6`, `Sonnet 4.6`, `Haiku 4.5`) with idle campus patrolling, pathfinding to buildings, and hovering work animation.
- **Building Interactions**: Hover for mapped folder path & live status; click to open the Folder Change Inspector with summaries and file-by-file diffs.
- **Construction & Ribbon-Cutting FX**: Active buildings show traffic cones, scaffolding, hazard tape, sparks, and an animated crane; completion triggers a ceremonial ribbon-cutting transition with golden scissors, USF confetti, and a completion banner.
- **Conflict Clash Animation & Resolution Prompt**: Two colliding agents play a 3-beat pixel-art clash (`BAM!` -> `CLASH!` -> `CONFLICT!`) before prompting the user to pick which agent works first while the other waits at the door.
- **Options Menu & Dual Representation**: Edit the root folder path, remap any building to a custom folder path (with Guarded Zone toggles), and switch seamlessly between the **Pixel Art USF Campus** and **Traditional Workflow Representation**.
- **The Oracle Feed**: Live USF campus newspaper-styled commit, lease, conflict, and ribbon-cutting feed.
