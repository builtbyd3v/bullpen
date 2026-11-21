# Bullpen — USF Tampa Pixel Campus Design Prototype

Standalone interactive pixel-art frontend design for **Bullpen**, modeled exclusively on the zoomed-in Central Campus & Athletics section of the USF Tampa Campus Greenway map and styled with the official USF brand color palette (`#006747` USF Green & `#CFC493` USF Gold).

## Quick Preview

Open `design/index.html` directly in any browser (no build step required), or serve this folder locally:

```sh
npx serve design
```

## Included Design Features

- **Zoomed-In USF Central Campus & Athletics Pixel Map**: Focused on Central Campus and USF Athletics (omitting USF Health and areas north of Marshall Student Center) with diagonal-hatched Greenway corridors, Castor Pond, USF Athletics stadiums, and high-detail architectural pixel buildings.
- **Folder-Name Building Plaques**: Every interactive building displays its mapped folder name (`BACKEND`, `FRONTEND`, `DOCS`, `DATABASE`, `CONFIG`, `TESTS`, `SCRIPTS`, `ASSETS`) live-updated whenever mappings change in Options.
- **High-Detail Pixel Architecture**: Custom multi-story pixel art for every landmark — ribbed Sun Dome arena with Guarded Zone shield, Marshall Student Center glass atrium, Engineering II solar array & animated HVAC fans, 3-floor USF Library tower, Muma Business inner courtyard & fountain, ISA glass lab wing, Rec Center clerestory roof, and Fine Arts sawtooth skylights.
- **Claude Model Bull Mascots**: Distinct USF-harmonized colors per Claude model (`Opus 4.6`, `Sonnet 4.6`, `Haiku 4.5`) with idle campus patrolling, road pathfinding to buildings, and hovering work animation.
- **Door Waiting Queue & Handoff**: Arriving agents wait outside occupied buildings with an impatient foot-tap, animated pixel hourglass, and `WAIT #1` badge, entering automatically once the building clears.
- **Construction & Ribbon-Cutting FX**: Active buildings show traffic cones, multi-tier scaffolding, hazard tape, sparks, and a tall animated crane; normal completion triggers a ceremonial ribbon-cutting transition with golden scissors, USF confetti, and a completion banner.
- **Dramatic Kick-Out Animation (Error / Time Limit)**: If an active agent hits an error or exceeds the configurable lease time limit, a dramatic 3-beat eviction plays (giant pixel boot, airborne tumbling Bull with smoke trail, ground `THUD!` bounce, and alert banner) and the waiting agent at the door immediately enters.
- **Options Menu & Dual Representation**: Edit the root folder path, configure the agent lease time limit (seconds), remap buildings to custom folder paths, and toggle seamlessly between the **Pixel Art USF Campus** and **Traditional Workflow Representation**.
- **The Oracle Feed**: Live USF campus newspaper-styled commit, lease, queue, eviction, and ribbon-cutting feed using folder names.
