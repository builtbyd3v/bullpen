import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_campus  # noqa: E402

SLOTS = ["msc", "library", "enb", "enc", "muma", "cooper", "rec"]


def make_repo(files, untracked=()):
    d = tempfile.mkdtemp()
    subprocess.run(["git", "init", "-q", d], check=True)
    for path, body in files.items():
        full = os.path.join(d, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write(body)
    subprocess.run(["git", "-C", d, "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x"],
        check=True,
    )
    for path in untracked:
        full = os.path.join(d, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write("u")
    return d


def by_id(layout):
    return {b["id"]: b for b in layout["buildings"]}


def spread(prefix, n):
    return {f"{prefix}/f{i}.txt": "x" for i in range(n)}


class MakeCampusTest(unittest.TestCase):
    def test_rank_by_count_tie_by_name(self):
        files = {**spread("zeta", 3), **spread("alpha", 2), **spread("beta", 2)}
        b = by_id(make_campus.build(make_repo(files)))
        self.assertEqual(b["msc"]["folder"], "zeta/")
        self.assertEqual(b["library"]["folder"], "alpha/")
        self.assertEqual(b["enb"]["folder"], "beta/")

    def test_guarded_takes_sundome(self):
        files = {**spread("db", 1), **spread("web", 5)}
        b = by_id(make_campus.build(make_repo(files)))
        self.assertEqual(b["sundome"]["folder"], "db/")
        self.assertTrue(b["sundome"]["guarded"])
        self.assertEqual(b["msc"]["folder"], "web/")
        self.assertFalse(b["msc"]["guarded"])

    def test_overflow_goes_to_annex(self):
        files = {}
        for i in range(9):
            files.update(spread(f"d{i}", 9 - i))
        layout = make_campus.build(make_repo(files))
        b = by_id(layout)
        self.assertEqual([b[s]["folder"] for s in SLOTS], [f"d{i}/" for i in range(7)])
        self.assertIsNone(b["juniper"]["folder"])
        self.assertEqual(b["juniper"]["files"], 2 + 1)
        self.assertLessEqual(len(layout["buildings"]), 10)

    def test_root_files_go_to_hub(self):
        files = {"README.md": "x", "LICENSE": "x", **spread("web", 2)}
        b = by_id(make_campus.build(make_repo(files)))
        self.assertEqual(b["bullrunner"]["folder"], "")
        self.assertEqual(b["bullrunner"]["files"], 2)

    def test_rooms_cap_subfolders_then_files(self):
        files = {}
        for i in range(3):
            files.update({f"web/s{i}/f{j}.txt": "x" for j in range(3 - i)})
        files["web/big.txt"] = "x" * 100
        files["web/small.txt"] = "x"
        files["web/mid.txt"] = "xxxx"
        rooms = by_id(make_campus.build(make_repo(files)))["msc"]["rooms"]
        self.assertEqual(len(rooms), 6)
        self.assertEqual([r["path"] for r in rooms[:3]], ["web/s0/", "web/s1/", "web/s2/"])
        self.assertEqual([r["path"] for r in rooms[3:]], ["web/big.txt", "web/mid.txt", "web/small.txt"])
        self.assertEqual(rooms[0], {"name": "s0", "path": "web/s0/", "files": 3})
        self.assertEqual(rooms[3]["files"], 1)

    def test_rooms_cap_with_many_subfolders(self):
        files = {}
        for i in range(8):
            files[f"web/s{i}/a.txt"] = "x"
        rooms = by_id(make_campus.build(make_repo(files)))["msc"]["rooms"]
        self.assertEqual(len(rooms), 6)
        self.assertTrue(all(r["path"].endswith("/") for r in rooms))

    def test_hidden_folders_go_to_annex(self):
        files = {**spread(".github", 9), **spread("web", 1)}
        b = by_id(make_campus.build(make_repo(files)))
        self.assertEqual(b["msc"]["folder"], "web/")
        self.assertEqual(b["juniper"]["files"], 9)

    def test_only_tracked_files_counted(self):
        repo = make_repo(spread("web", 2), untracked=["web/new.txt", "ghost/a.txt"])
        b = by_id(make_campus.build(repo))
        self.assertEqual(b["msc"]["files"], 2)
        self.assertNotIn("ghost/", [x["folder"] for x in b.values()])

    def test_identical_bytes_twice(self):
        repo = make_repo({**spread("web", 3), **spread("db", 1), "README.md": "x"})
        out = os.path.join(tempfile.mkdtemp(), "c.json")
        make_campus.main([repo, "--out", out])
        with open(out, "rb") as fh:
            first = fh.read()
        make_campus.main([repo, "--out", out])
        with open(out, "rb") as fh:
            self.assertEqual(first, fh.read())
        self.assertTrue(first.endswith(b"\n"))
        self.assertEqual(json.loads(first)["repo"], os.path.basename(repo))

    def test_no_guarded_folder_keeps_sundome(self):
        b = by_id(make_campus.build(make_repo(spread("web", 2))))
        self.assertEqual(b["sundome"]["folder"], "db/")
        self.assertTrue(b["sundome"]["guarded"])
        self.assertEqual(b["sundome"]["files"], 0)
        self.assertEqual(b["sundome"]["rooms"], [])

    def test_unused_slots_omitted_and_fixed_geometry(self):
        layout = make_campus.build(make_repo(spread("web", 2)))
        b = by_id(layout)
        self.assertNotIn("library", b)
        self.assertEqual((b["msc"]["x"], b["msc"]["y"], b["msc"]["w"], b["msc"]["h"]), (380, 60, 200, 110))
        self.assertEqual((layout["width"], layout["height"]), (960, 640))
        for k in ("juniper", "bullrunner"):
            self.assertIn(k, b)

    def test_guarded_flag_repeatable_and_comma(self):
        files = {**spread("db", 1), **spread("secrets", 4), **spread("web", 2)}
        repo = make_repo(files)
        out = os.path.join(tempfile.mkdtemp(), "c.json")
        make_campus.main([repo, "--out", out, "--guarded", "db/,secrets/"])
        with open(out) as fh:
            b = by_id(json.load(fh))
        self.assertEqual(b["sundome"]["folder"], "secrets/")  # largest guarded takes the slot
        self.assertEqual(b["msc"]["folder"], "web/")
        self.assertEqual(b["library"]["folder"], "db/")  # second guarded folder: normal slot, still guarded
        self.assertTrue(b["library"]["guarded"])

    def test_slots_do_not_overlap(self):
        layout = make_campus.build(make_repo(spread("web", 2)))
        full = make_campus.SLOTS
        rects = [(s["x"], s["y"], s["w"], s["h"]) for s in full.values()]
        for i, a in enumerate(rects):
            self.assertTrue(a[0] >= 0 and a[1] >= 0 and a[0] + a[2] <= 960 and a[1] + a[3] <= 640)
            for b in rects[i + 1:]:
                self.assertTrue(a[0] + a[2] <= b[0] or b[0] + b[2] <= a[0] or a[1] + a[3] <= b[1] or b[1] + b[3] <= a[1], (a, b))
        self.assertTrue(layout)


if __name__ == "__main__":
    unittest.main()
