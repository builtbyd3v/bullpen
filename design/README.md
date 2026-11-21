# Bullpen — USF Tampa Pixel Campus Design Prototype

Standalone interactive pixel-art frontend design for **Bullpen**, modeled exclusively on the USF Tampa Campus Greenway map and styled with the official USF brand color palette (`#006747` USF Green & `#CFC493` USF Gold).

## Quick Preview

Open `design/index.html` directly in any browser (no build step required), or serve this folder locally:

```sh
npx serve design
```

## Included Design Features

- **Pre-Map Repository Analyzer**: Runs before displaying the campus map to count top-level repository folders via a local directory picker (`webkitdirectory`), quick repo-size presets (3 / 4 / 8 / 12 folders), or a custom folder list (1–14 folders).
- **Dynamic Adaptive Map Cropping & Building Scaling**: Activates exactly `N` buildings matching the analyzed repo's folder count and crops the USF Tampa Campus viewport tightly around all `N` buildings (including crane, doorway, and queue margins) so every folder is guaranteed visible.
- **Folder-Name Building Plaques**: Every active building displays its mapped folder name (`BACKEND`, `FRONTEND`, `DOCS`, `DATABASE`, etc.), updating live when folders are added, removed, or remapped in Options.
- **High-Detail Pixel Architecture (14 USF Campus Buildings)**: Custom multi-story pixel art for every landmark — ribbed Sun Dome arena with Guarded Zone shield, Marshall Student Center glass atrium, Engineering II solar array & animated HVAC fans, 3-floor USF Library tower, Muma Business inner courtyard & fountain, ISA glass lab wing, Rec Center clerestory roof, Fine Arts sawtooth skylights, Cooper Hall, Student Services, Education, Juniper-Poplar, University Tower South, and Alumni Center.
- **Claude Model Bull Mascots**: Distinct USF-harmonized colors per Claude model (`Opus 4.6`, `Sonnet 4.6`, `Haiku 4.5`) with crop-aware campus road patrolling and hovering work animation.
- **Door Waiting Queue & Handoff**: Arriving agents wait outside occupied buildings with an impatient foot-tap, animated pixel hourglass, and `WAIT #1` badge, entering automatically once the building clears.
- **Construction & Ribbon-Cutting FX**: Active buildings show traffic cones, multi-tier scaffolding, hazard tape, sparks, and a tall animated crane; normal completion triggers a ceremonial ribbon-cutting transition with golden scissors, USF confetti, and a completion banner.
- **Dramatic Kick-Out Animation (Error / Time Limit)**: If an active agent hits an error or exceeds the configurable lease time limit, a dramatic 3-beat eviction plays (giant pixel boot, airborne tumbling Bull with smoke trail, ground `THUD!` bounce, and alert banner) and the waiting agent at the door immediately enters.
- **Options Menu & Dual Representation**: Edit the root folder path, configure the agent lease time limit (seconds), add/remove/remap folders with live map re-cropping, and toggle seamlessly between the **Pixel Art USF Campus** and **Traditional Workflow Representation**.
- **The Oracle Feed**: Live USF campus newspaper-styled commit, lease, queue, eviction, and ribbon-cutting feed using folder names.
