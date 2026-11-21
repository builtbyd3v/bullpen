"""Unit tests: referee state, file -> building, git log parsing, path normalization. No server."""

import asyncio
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import helpers  # noqa: F401  (sets env vars and sys.path before the server modules load)
from helpers import TMP, git, make_demo

import gitops
import main
import referee
from config import LEASE_TTL
from referee import Referee, building_for, iso


class Clock:
    """Patch time.time() inside referee so expiry is tested without sleeping."""

    def __init__(self, start=1_000_000.0):
        self.now = start
        self.patch = mock.patch.object(referee.time, "time", lambda: self.now)

    def __enter__(self):
        self.patch.start()
        return self

    def __exit__(self, *exc):
        self.patch.stop()


class LeaseLogicTests(unittest.TestCase):
    def test_free_file_is_granted_for_ttl(self):
        with Clock() as clock:
            ok, lease = Referee().claim("api/a.py", "api")
        self.assertTrue(ok)
        self.assertEqual((lease.agent, lease.expires), ("api", clock.now + LEASE_TTL))

    def test_holder_renews_its_own_lease(self):
        r = Referee()
        with Clock() as clock:
            r.claim("f", "api")
            clock.now += 30
            ok, lease = r.claim("f", "api")
        self.assertTrue(ok)
        self.assertEqual(lease.expires, clock.now + LEASE_TTL)

    def test_other_agent_waits_and_is_queued_once(self):
        r = Referee()
        with Clock() as clock:
            r.claim("f", "api")
            first, lease = r.claim("f", "web")
            since = r.waiters["f"]["web"]
            clock.now += 5
            again, _ = r.claim("f", "web")  # retrying must not move it to the back of the queue
        self.assertFalse(first or again)
        self.assertEqual(lease.agent, "api")
        self.assertEqual(r.waiters["f"], {"web": since})

    def test_queue_is_oldest_first(self):
        r = Referee()
        with Clock() as clock:
            r.claim("f", "api")
            r.claim("f", "web")
            clock.now += 1
            r.claim("f", "db")
        self.assertEqual(r.public_leases()[0]["waiters"], ["web", "db"])

    def test_waiter_leaves_queue_when_it_gets_the_lease(self):
        r = Referee()
        r.claim("f", "api")
        r.claim("f", "web")
        r.release("f", "api")
        ok, _ = r.claim("f", "web")
        self.assertTrue(ok)
        self.assertNotIn("web", r.waiters.get("f", {}))

    def test_expired_lease_can_be_taken_by_another_agent(self):
        r = Referee()
        with Clock() as clock:
            r.claim("f", "api")
            clock.now += LEASE_TTL  # exactly at expiry counts as expired
            ok, lease = r.claim("f", "web")
        self.assertTrue(ok)
        self.assertEqual(lease.agent, "web")

    def test_only_the_holder_can_release(self):
        r = Referee()
        r.claim("f", "api")
        self.assertIsNone(r.release("f", "web"))
        self.assertIsNone(r.release("missing", "api"))
        self.assertEqual(r.leases["f"].agent, "api")
        self.assertIsNotNone(r.release("f", "api"))
        self.assertNotIn("f", r.leases)

    def test_renew_only_by_holder(self):
        r = Referee()
        r.claim("f", "api")
        self.assertFalse(r.renew("f", "web"))
        self.assertFalse(r.renew("other", "api"))
        self.assertTrue(r.renew("f", "api"))

    def test_release_agent_drops_leases_and_queue_spots_only_for_that_agent(self):
        r = Referee()
        r.claim("a", "api")
        r.claim("b", "api")
        r.claim("c", "web")
        r.claim("c", "api")  # api waits on c
        released = r.release_agent("api")
        self.assertEqual(sorted(lease.file for lease in released), ["a", "b"])
        self.assertEqual(list(r.leases), ["c"])
        self.assertNotIn("api", r.waiters["c"])

    def test_expire_drops_expired_leases_and_stale_waiters(self):
        r = Referee()
        with Clock() as clock:
            r.claim("old", "api")
            r.claim("old", "web")
            clock.now += LEASE_TTL - 1
            r.claim("fresh", "db")
            clock.now += 1
            expired = r.expire()
        self.assertEqual([lease.file for lease in expired], ["old"])
        self.assertEqual(list(r.leases), ["fresh"])
        self.assertNotIn("old", r.waiters)  # empty queues are removed too

    def test_expire_with_nothing_is_a_no_op(self):
        self.assertEqual(Referee().expire(), [])


class ApprovalLogicTests(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_allow_resolves_future_and_is_remembered(self):
        async def go():
            r = Referee()
            ap = r.open_approval("db", "Edit", "db/a.sql", "guarded")
            self.assertIs(r.pending("db", "db/a.sql"), ap)
            self.assertIsNone(r.pending("api", "db/a.sql"))
            self.assertIs(r.resolve(ap.id, "allow"), ap)
            self.assertEqual(await ap.future, ("allow", ""))
            self.assertIn(("db", "db/a.sql"), r.approved)
            self.assertEqual(r.approvals, {})
        self.run_async(go())

    def test_deny_and_timeout_are_not_remembered(self):
        async def go():
            r = Referee()
            a = r.open_approval("db", "Edit", "x", "")
            b = r.open_approval("db", "Edit", "y", "")
            r.resolve(a.id, "deny", "use a migration")
            r.resolve(b.id, "timeout")
            self.assertEqual(await a.future, ("deny", "use a migration"))
            self.assertEqual(r.approved, set())
        self.run_async(go())

    def test_resolving_twice_or_unknown_id_returns_none(self):
        async def go():
            r = Referee()
            ap = r.open_approval("db", "Edit", "x", "")
            r.resolve(ap.id, "allow")
            self.assertIsNone(r.resolve(ap.id, "deny"))
            self.assertIsNone(r.resolve("nope", "allow"))
        self.run_async(go())

    def test_ids_are_unique(self):
        async def go():
            r = Referee()
            ids = {r.open_approval("db", "Edit", str(i), "").id for i in range(5)}
            self.assertEqual(len(ids), 5)
        self.run_async(go())

    def test_public_shape_has_expires_at(self):
        async def go():
            ap = Referee().open_approval("db", "Edit", "db/a.sql", "guarded")
            self.assertEqual(set(ap.public()), {"id", "agent", "tool", "target", "reason", "expires_at"})
            self.assertTrue(ap.public()["expires_at"].endswith("Z"))
        self.run_async(go())

    def test_forget_clears_only_that_agent(self):
        r = Referee()
        r.approved = {("db", "x"), ("api", "y")}
        r.notices = {"db": "secret", "api": "secret"}
        r.forget("db")
        self.assertEqual(r.approved, {("api", "y")})
        self.assertEqual(list(r.notices), ["api"])


class StatusTests(unittest.TestCase):
    def test_precedence_blocked_then_waiting_then_done_then_working(self):
        async def go():
            r = Referee()
            self.assertEqual(r.status("api"), "working")
            r.agent("api").done = True
            self.assertEqual(r.status("api"), "done")
            r.claim("f", "web")
            r.claim("f", "api")
            self.assertEqual(r.status("api"), "waiting")
            r.open_approval("api", "Edit", "db/x", "")
            self.assertEqual(r.status("api"), "blocked")
        asyncio.run(go())

    def test_claims_are_unique_building_ids(self):
        r = Referee()
        r.claim("api/a.py", "api")
        r.claim("api/b.py", "api")
        r.claim("web/c.ts", "api")
        self.assertEqual(r.claims("api"), ["enb", "msc"])
        self.assertEqual(r.claims("web"), [])


class BuildingTests(unittest.TestCase):
    def test_folder_prefix(self):
        self.assertEqual(building_for("api/users.py"), "enb")
        self.assertEqual(building_for("web/app/page.tsx"), "msc")

    def test_longest_prefix_wins(self):
        self.assertEqual(building_for("api/internal/auth.py"), "lab")

    def test_prefix_must_match_a_whole_folder(self):
        self.assertEqual(building_for("apiary/x.py"), "juniper")  # not "api/"

    def test_root_file_goes_to_the_hub(self):
        self.assertEqual(building_for("README.md"), "bullrunner")
        self.assertEqual(building_for("db"), "bullrunner")  # a file named like a folder

    def test_unmapped_folder_goes_to_the_annex(self):
        self.assertEqual(building_for("tools/x.sh"), "juniper")

    def test_missing_campus_file_falls_back_to_default_ids(self):
        with mock.patch.object(referee, "CAMPUS_FILE", TMP / "missing.json"), \
                mock.patch.dict(referee._campus, {"mtime": None, "buildings": []}):
            self.assertEqual(building_for("README.md"), "bullrunner")
            self.assertEqual(building_for("api/x.py"), "juniper")

    def test_campus_file_is_reloaded_when_it_changes(self):
        path = Path(tempfile.mkdtemp(dir=TMP)) / "campus.json"
        path.write_text(json.dumps({"buildings": [{"id": "one", "folder": "api/"}]}))
        with mock.patch.object(referee, "CAMPUS_FILE", path), \
                mock.patch.dict(referee._campus, {"mtime": None, "buildings": []}):
            self.assertEqual(building_for("api/x.py"), "one")
            path.write_text(json.dumps({"buildings": [{"id": "two", "folder": "api/"}]}))
            os.utime(path, (time.time() + 5, time.time() + 5))
            self.assertEqual(building_for("api/x.py"), "two")

    def test_iso_is_utc_with_z(self):
        self.assertEqual(iso(0), "1970-01-01T00:00:00Z")


class RepoFileTests(unittest.TestCase):
    """main.repo_file: tool_input path -> path relative to the worktree root."""

    @classmethod
    def setUpClass(cls):
        cls.wt = Path(tempfile.mkdtemp(dir=TMP)) / "demo-api"
        (cls.wt / "api").mkdir(parents=True)
        (cls.wt.parent / "demo-api2").mkdir()

    def rel(self, file_path=None, cwd=None, notebook=None, worktree="default"):
        tool_input = {}
        if file_path is not None:
            tool_input["file_path"] = str(file_path)
        if notebook is not None:
            tool_input["notebook_path"] = str(notebook)
        body = {"tool_input": tool_input, **({"cwd": str(cwd)} if cwd else {})}
        return main.repo_file(body, self.wt if worktree == "default" else worktree)

    def test_absolute_path_inside(self):
        self.assertEqual(self.rel(self.wt / "api" / "users.py"), "api/users.py")

    def test_relative_path_uses_cwd(self):
        self.assertEqual(self.rel("users.py", cwd=self.wt / "api"), "api/users.py")

    def test_relative_path_without_cwd_uses_worktree(self):
        self.assertEqual(self.rel("api/users.py"), "api/users.py")

    def test_dot_dot_inside_is_normalized(self):
        self.assertEqual(self.rel(self.wt / "api" / ".." / "web" / "x.ts"), "web/x.ts")

    def test_dot_dot_escaping_the_worktree_is_rejected(self):
        self.assertIsNone(self.rel(self.wt / ".." / "elsewhere.txt"))

    def test_sibling_folder_with_same_prefix_is_outside(self):
        self.assertIsNone(self.rel(self.wt.parent / "demo-api2" / "x.py"))

    def test_notebook_path(self):
        self.assertEqual(self.rel(notebook=self.wt / "nb.ipynb"), "nb.ipynb")

    def test_no_path_or_no_worktree(self):
        self.assertIsNone(self.rel())
        self.assertIsNone(self.rel(self.wt / "api" / "x.py", worktree=None))


class GitopsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(dir=TMP))
        cls.repo, cls.wt = make_demo(cls.root, ("api", "web"))
        git(cls.repo, "branch", "feature")  # not an agent branch: must be ignored

    def test_worktrees_lists_only_agent_branches(self):
        trees = asyncio.run(gitops.worktrees(self.repo))
        self.assertEqual(sorted(trees), ["api", "web"])
        self.assertEqual(Path(trees["api"]).resolve(), self.wt["api"].resolve())

    def test_commit_writes_trailers_author_and_one_line_task(self):
        wt = self.wt["api"]
        (wt / "api" / "t.py").write_text("x = 1\n")
        diff = asyncio.run(gitops.stage(wt, "api/t.py"))
        self.assertIn("+x = 1", diff)
        sha = asyncio.run(gitops.commit(wt, "api/t.py", 'Fix "quotes" | ünïcode', "api", "line one\nline two"))
        body = git(wt, "log", "-1", "--format=%an <%ae>%n%B")
        self.assertIn("agent api <api@bullpen.local>", body)
        self.assertIn("Bullpen-Agent: api", body)
        self.assertIn("Bullpen-Task: line one line two", body)
        commits = asyncio.run(gitops.log(wt, "-1"))
        self.assertEqual(commits[0]["sha"], sha)
        self.assertEqual(commits[0]["message"], 'Fix "quotes" | ünïcode')
        self.assertEqual((commits[0]["agent"], commits[0]["task"]), ("api", "line one line two"))
        self.assertEqual(commits[0]["files"], ["api/t.py"])

    def test_empty_task_becomes_none(self):
        wt = self.wt["web"]
        (wt / "web" / "e.ts").write_text("1\n")
        asyncio.run(gitops.stage(wt, "web/e.ts"))
        asyncio.run(gitops.commit(wt, "web/e.ts", "msg", "web", "   "))
        self.assertIn("Bullpen-Task: none", git(wt, "log", "-1", "--format=%B"))

    def test_unchanged_file_stages_an_empty_diff(self):
        self.assertEqual(asyncio.run(gitops.stage(self.wt["web"], "web/README.md")).strip(), "")

    def test_log_without_trailers_has_empty_fields(self):
        commits = asyncio.run(gitops.log(self.repo, "-1", "main"))
        self.assertEqual((commits[0]["message"], commits[0]["agent"], commits[0]["task"]), ("Demo repo", "", ""))

    def test_log_of_empty_range_is_empty(self):
        self.assertEqual(asyncio.run(gitops.log(self.repo, "main..main")), [])

    def test_touches_is_per_file_and_per_direction(self):
        wt = self.wt["web"]
        (wt / "web" / "touch.ts").write_text("1\n")
        asyncio.run(gitops.stage(wt, "web/touch.ts"))
        asyncio.run(gitops.commit(wt, "web/touch.ts", "msg", "web", "t"))
        self.assertTrue(asyncio.run(gitops.touches(self.repo, "main", "agent/web", "web/touch.ts")))
        self.assertFalse(asyncio.run(gitops.touches(self.repo, "main", "agent/web", "web/README.md")))
        self.assertFalse(asyncio.run(gitops.touches(self.repo, "agent/web", "main", "web/touch.ts")))  # main did not

    def test_merge_refuses_when_main_is_not_checked_out(self):
        with self.assertRaises(gitops.GitError):
            asyncio.run(gitops.merge(self.wt["api"], "main", "agent/web", "msg"))


if __name__ == "__main__":
    unittest.main()
