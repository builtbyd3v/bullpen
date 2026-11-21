#!/usr/bin/env python3
"""Generate campus/campus.json from a git repo. Rules: shared/events.md, "Campus layout"."""
import argparse
import json
import os
import subprocess
import sys
from collections import Counter

# Fixed slots: id -> name and position on the 1160x728 map, which is Caua's USF campus
# (design/js/campusData.js, 580x364) at 2x. Sizes are the design/mockups-v3 sprites at 2x.
# Never change these per repo.
WIDTH, HEIGHT = 1160, 728
SLOTS = {
    "msc": {"name": "Marshall Student Center", "x": 316, "y": 48, "w": 136, "h": 88},
    "library": {"name": "Library", "x": 412, "y": 356, "w": 104, "h": 84},
    "enb": {"name": "ENB", "x": 192, "y": 424, "w": 144, "h": 92},
    "enc": {"name": "ENC", "x": 248, "y": 216, "w": 104, "h": 76},
    "muma": {"name": "Muma Business", "x": 540, "y": 424, "w": 112, "h": 104},
    "cooper": {"name": "Cooper Hall", "x": 540, "y": 348, "w": 100, "h": 52},
    "rec": {"name": "Recreation Center", "x": 696, "y": 264, "w": 132, "h": 76},
    "sundome": {"name": "Sun Dome", "x": 740, "y": 384, "w": 152, "h": 124},
    "juniper": {"name": "Juniper-Poplar", "x": 36, "y": 348, "w": 88, "h": 76},
    "bullrunner": {"name": "Bull Runner stop", "x": 408, "y": 160, "w": 88, "h": 52},
}
FILL_ORDER = ["msc", "library", "enb", "enc", "muma", "cooper", "rec"]
MAX_ROOMS = 6


def tracked(repo):
    out = subprocess.run(
        ["git", "-C", repo, "ls-files", "-z"], check=True, capture_output=True
    ).stdout.decode("utf-8", "surrogateescape")
    return sorted(p for p in out.split("\0") if p)


def rooms_for(repo, folder, files):
    """Subfolders by file count (ties by name), then largest files (bytes desc, then name)."""
    sub, direct = Counter(), []
    for p in files:
        rest = p[len(folder):]
        if "/" in rest:
            sub[rest.split("/", 1)[0]] += 1
        else:
            direct.append(p)
    rooms = [
        {"name": n, "path": f"{folder}{n}/", "files": c}
        for n, c in sorted(sub.items(), key=lambda kv: (-kv[1], kv[0]))
    ][:MAX_ROOMS]
    if len(rooms) < MAX_ROOMS:
        def size(p):
            try:
                return os.path.getsize(os.path.join(repo, p))
            except OSError:
                return 0
        direct.sort(key=lambda p: (-size(p), p))
        rooms += [{"name": os.path.basename(p), "path": p, "files": 1} for p in direct[: MAX_ROOMS - len(rooms)]]
    return rooms


def building(slot_id, folder, guarded, repo, files):
    s = SLOTS[slot_id]
    return {
        "id": slot_id, "name": s["name"], "folder": folder, "guarded": guarded,
        "x": s["x"], "y": s["y"], "w": s["w"], "h": s["h"],
        "files": len(files),
        "rooms": rooms_for(repo, folder, files) if folder else [],
    }


def build(repo, guarded=("db/",)):
    repo = os.path.abspath(repo)
    guarded = [g if g.endswith("/") else g + "/" for g in guarded]
    groups = {}  # top folder (with /) -> files
    root = []
    for p in tracked(repo):
        if "/" in p:
            groups.setdefault(p.split("/", 1)[0] + "/", []).append(p)
        else:
            root.append(p)
    # Hidden folders (.github, .claude) are tooling, not campus: they always go to the Annex.
    hidden = sorted(f for f in groups if f.startswith("."))
    ranked = sorted((f for f in groups if f not in hidden), key=lambda f: (-len(groups[f]), f))
    # One guarded folder takes the Sun Dome: the biggest present one, else the first named (empty dome).
    present = [f for f in ranked if f in guarded]
    dome = present[0] if present else guarded[0]
    rest = [f for f in ranked if f != dome]
    placed = dict(zip(FILL_ORDER, rest))
    annex = [f for f in rest if f not in placed.values()] + [f for f in hidden if f != dome]
    annex_files = [p for f in annex for p in groups[f]]

    out = []
    for sid in FILL_ORDER:
        if sid in placed:
            out.append(building(sid, placed[sid], placed[sid] in guarded, repo, groups[placed[sid]]))
    out.append(building("sundome", dome, True, repo, groups.get(dome, [])))
    j = building("juniper", None, False, repo, annex_files)
    j["rooms"] = [
        {"name": f.rstrip("/"), "path": f, "files": len(groups[f])} for f in annex[:MAX_ROOMS]
    ]
    out.append(j)
    h = building("bullrunner", "", False, repo, root)
    h["rooms"] = rooms_for(repo, "", root)
    out.append(h)
    return {"repo": os.path.basename(repo), "width": WIDTH, "height": HEIGHT, "buildings": out}


def main(argv=None):
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="Write campus.json for a git repo.")
    ap.add_argument("repo")
    ap.add_argument("--out", default=os.path.join(here, "..", "campus", "campus.json"))
    ap.add_argument("--guarded", action="append", default=None,
                    help="guarded folder(s); repeatable or comma list (default db/)")
    a = ap.parse_args(argv)
    guarded = [g.strip() for v in (a.guarded or ["db/"]) for g in v.split(",") if g.strip()]
    layout = build(a.repo, guarded)
    out = os.path.abspath(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write(json.dumps(layout, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
