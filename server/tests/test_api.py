"""Integration tests: the real server against a fake Jetson and a throwaway demo repo.

Each class gets its own repo, Jetson and server. Tests inside a class use distinct files.
"""

import time
import unittest

import helpers  # noqa: F401  (env and sys.path first)
from helpers import TMP, FakeJetson, Server, ServerCase, free_port, git, make_demo, wait_until


class LeaseTests(ServerCase):
    def test_grant_and_renew_by_the_same_agent(self):
        first = self.checkout("api", "api/renew.py")
        self.assertEqual((first["decision"], first["holder"], first["file"]), ("allow", "api", "api/renew.py"))
        time.sleep(1.1)
        second = self.checkout("api", "api/renew.py")
        self.assertEqual(second["decision"], "allow")
        self.assertGreater(second["expires_at"], first["expires_at"])

    def test_other_agents_wait_in_order_with_a_reason(self):
        self.checkout("api", "api/busy.py")
        web = self.checkout("web", "api/busy.py")
        self.assertEqual((web["decision"], web["holder"]), ("wait", "api"))
        self.assertIn("leased by agent api", web["reason"])
        time.sleep(0.05)
        self.assertEqual(self.checkout("db", "api/busy.py")["decision"], "wait")
        self.assertEqual(self.lease("api/busy.py")["waiters"], ["web", "db"])
        self.assertEqual(self.worktree("web")["status"], "waiting")

    def test_same_file_in_different_worktrees_is_one_lease(self):
        a = self.checkout("api", "shared/one.ts")
        b = self.checkout("web", "shared/one.ts")
        self.assertEqual(a["file"], b["file"])
        self.assertEqual(b["decision"], "wait")

    def test_relative_and_dot_dot_paths_are_normalized(self):
        body = self.body("api", tool="Edit", tool_input={"file_path": "api/../api/norm.py"})
        status, reply = self.server.call("POST", "/checkout", body)
        self.assertEqual((status, reply["file"]), (200, "api/norm.py"))
        self.assertEqual(self.checkout("web", "api/norm.py")["decision"], "wait")

    def test_path_outside_the_worktree_gets_policy_but_no_lease(self):
        body = self.body("api", tool="Write", tool_input={"file_path": str(TMP / "outside.txt")})
        reply = self.server.call("POST", "/checkout", body)[1]
        self.assertEqual((reply["decision"], reply["file"]), ("allow", None))

    def test_unknown_agent_is_inferred_from_its_worktree(self):
        body = self.body("web", "web/who.ts")
        body["agent"] = "unknown"
        reply = self.server.call("POST", "/checkout", body)[1]
        self.assertEqual(reply["holder"], "web")

    def test_stop_releases_leases_and_frees_the_files(self):
        mark = self.events.mark()
        self.checkout("db", "docs/s1.md")
        self.checkout("db", "docs/s2.md")
        self.assertEqual(self.checkout("api", "docs/s1.md")["decision"], "wait")
        self.hook("db", "Stop")
        released = self.events.since(mark, "claim_released")
        self.assertEqual(sorted(e["data"]["file"] for e in released if e["data"]["text"] == "stop"),
                         ["docs/s1.md", "docs/s2.md"])
        self.assertEqual(self.checkout("api", "docs/s1.md")["decision"], "allow")

    def test_stop_without_leases_is_harmless(self):
        self.hook("web", "Stop")
        self.hook("nobody", "Stop")

    def test_bash_gets_a_policy_check_but_no_lease(self):
        reply = self.checkout("api", None, tool="Bash", tool_input={"command": "ls -la"})
        self.assertEqual((reply["decision"], reply["file"]), ("allow", None))
        self.assertIn(("/check", {"agent": "api", "tool_name": "Bash", "command": "ls -la"}), self.jetson.calls)

    def test_notebook_edit_uses_notebook_path(self):
        body = self.body("api", tool="NotebookEdit",
                         tool_input={"notebook_path": str(self.wt["api"] / "docs" / "nb.ipynb")})
        self.assertEqual(self.server.call("POST", "/checkout", body)[1]["file"], "docs/nb.ipynb")

    def test_read_only_tools_never_take_a_lease(self):
        reply = self.checkout("api", "api/read.py", tool="Read")
        self.assertEqual((reply["decision"], reply["file"]), ("allow", None))
        self.assertIsNone(self.lease("api/read.py"))

    def test_old_hook_path_maps_wait_to_deny(self):
        self.checkout("api", "api/compat.py")
        body = self.body("web", "api/compat.py", event="PreToolUse")
        status, reply = self.server.call("POST", "/hook", body)
        self.assertEqual((status, reply["decision"]), (200, "deny"))
        self.assertIn("leased by agent api", reply["reason"])

    def test_events_are_envelopes_in_order(self):
        mark = self.events.mark()
        self.checkout("api", "api/events.py")
        self.checkout("web", "api/events.py")
        self.events.wait("claim_wait", since=mark)
        types = [e["type"] for e in self.events.since(mark)]
        self.assertLess(types.index("claim_granted"), types.index("claim_wait"))
        self.assertTrue(all({"type", "data"} <= set(e) for e in self.events.since(mark)))


class LeaseExpiryTests(ServerCase):
    env = {"BULLPEN_LEASE_TTL": 2}

    def test_lease_expires_and_the_file_is_free(self):
        mark = self.events.mark()
        self.checkout("api", "api/expire.py")
        event = self.events.wait("claim_released", lambda d: d["file"] == "api/expire.py", since=mark, timeout=6)
        self.assertEqual(event["data"]["text"], "expired")
        self.assertEqual(self.checkout("web", "api/expire.py")["decision"], "allow")

    def test_a_waiter_that_never_retries_leaves_the_queue(self):
        self.checkout("api", "api/stale.py")
        self.checkout("web", "api/stale.py")
        for _ in range(4):  # api keeps its lease alive; web never retries
            time.sleep(0.9)
            self.checkout("api", "api/stale.py")
        self.assertEqual(self.lease("api/stale.py")["waiters"], [])
        self.assertNotEqual(self.worktree("web")["status"], "waiting")


class KeepLeaseAfterCommitTests(ServerCase):
    env = {"BULLPEN_RELEASE_ON_COMMIT": "0"}

    def test_lease_survives_the_commit_until_stop(self):
        self.edit_and_commit("api", "api/kept.py", "x = 1\n")
        self.assertEqual(self.checkout("web", "api/kept.py")["decision"], "wait")
        self.hook("api", "Stop")
        self.assertEqual(self.checkout("web", "api/kept.py")["decision"], "allow")


class PolicyTests(ServerCase):
    def test_jetson_deny_passes_its_reason_and_takes_no_lease(self):
        reply = self.checkout("api", "api/forbidden.py")
        self.assertEqual((reply["decision"], reply["reason"]), ("deny", "Blocked by test rule"))
        self.assertIsNone(self.lease("api/forbidden.py"))

    def test_jetson_error_fails_closed(self):
        self.jetson.modes["/check"] = "down"
        mark = self.events.mark()
        reply = self.checkout("api", "api/down.py")
        self.assertEqual((reply["decision"], reply["reason"]), ("deny", "Bullpen policy offline"))
        check = self.events.wait("check", lambda d: d["file"] == "api/down.py", since=mark)["data"]
        self.assertEqual((check["decision"], check["rule"], check["model"]), ("deny", "offline", ""))

    def test_jetson_bad_reply_fails_closed(self):
        self.jetson.modes["/check"] = "bad"
        self.assertEqual(self.checkout("api", "api/bad.py")["decision"], "deny")

    def test_check_event_has_all_fields(self):
        mark = self.events.mark()
        self.checkout("api", "api/fields.py")
        check = self.events.wait("check", lambda d: d["file"] == "api/fields.py", since=mark)["data"]
        self.assertEqual(set(check), {"agent", "tool", "file", "decision", "rule", "latency_ms", "model", "at"})
        self.assertEqual((check["decision"], check["rule"], check["model"]), ("allow", "default", "rules"))
        self.assertIsInstance(check["latency_ms"], int)

    def test_dangerous_bash_is_denied(self):
        reply = self.checkout("api", None, tool="Bash", tool_input={"command": "rm -rf /"})
        self.assertEqual(reply["decision"], "deny")


class UnreachableJetsonTests(ServerCase):
    jetson_url = f"http://127.0.0.1:{free_port()}"  # nothing listens here

    def test_every_edit_is_denied(self):
        for agent, rel in (("api", "api/x.py"), ("web", "web/y.ts")):
            reply = self.checkout(agent, rel)
            self.assertEqual((reply["decision"], reply["reason"]), ("deny", "Bullpen policy offline"))
        self.assertEqual(self.state()["leases"], [])


class ApprovalTests(ServerCase):
    env = {"BULLPEN_APPROVAL_TIMEOUT": 4}

    def pending(self, target, mark):
        return self.events.wait("approval_needed", lambda d: d["target"] == target, since=mark)["data"]

    def test_approve_answers_the_held_request_and_is_remembered(self):
        mark = self.events.mark()
        held = self.checkout_async("db", "db/allow.sql")
        approval = self.pending("db/allow.sql", mark)
        state = self.state()
        self.assertEqual(self.worktree("db")["status"], "blocked")
        self.assertTrue(state["approvals"][0]["expires_at"].endswith("Z"))
        self.assertEqual(self.server.call("POST", f"/approve/{approval['id']}", {"decision": "allow"})[0], 200)
        self.assertEqual(held.result(10)["decision"], "allow")
        self.events.wait("approved", lambda d: d["id"] == approval["id"], since=mark)
        again = self.events.mark()
        self.assertEqual(self.checkout("db", "db/allow.sql")["decision"], "allow")
        self.assertEqual(self.events.since(again, "approval_needed"), [])

    def test_deny_with_a_note_reaches_the_agent(self):
        mark = self.events.mark()
        held = self.checkout_async("db", "db/deny.sql")
        approval = self.pending("db/deny.sql", mark)
        self.server.call("POST", f"/approve/{approval['id']}", {"decision": "deny", "reason": "Add a migration instead."})
        reply = held.result(10)
        self.assertEqual(reply["decision"], "deny")
        self.assertIn("Add a migration instead.", reply["reason"])
        self.assertEqual(self.events.wait("denied", lambda d: d["id"] == approval["id"], since=mark)["data"]["text"],
                         "human")

    def test_no_answer_times_out_as_deny(self):
        mark = self.events.mark()
        start = time.monotonic()
        reply = self.checkout("db", "db/timeout.sql")
        self.assertEqual(reply["decision"], "deny")
        self.assertIn("No human approved", reply["reason"])
        self.assertGreaterEqual(time.monotonic() - start, 3)
        self.assertEqual(self.events.wait("denied", since=mark)["data"]["text"], "timeout")
        self.assertEqual(self.state()["approvals"], [])

    def test_retries_while_pending_share_one_approval(self):
        mark = self.events.mark()
        first = self.checkout_async("db", "db/shared.sql")
        approval = self.pending("db/shared.sql", mark)
        second = self.checkout_async("db", "db/shared.sql")
        time.sleep(0.5)
        self.assertEqual(len(self.events.since(mark, "approval_needed")), 1)
        self.server.call("POST", f"/approve/{approval['id']}", {"decision": "allow"})
        self.assertEqual({first.result(10)["decision"], second.result(10)["decision"]}, {"allow"})

    def test_approval_does_not_bypass_the_lease(self):
        mark = self.events.mark()
        a = self.checkout_async("db", "db/both.sql")
        b = self.checkout_async("api", "db/both.sql")
        first = self.pending("db/both.sql", mark)
        second = self.events.wait("approval_needed", lambda d: d["target"] == "db/both.sql" and d["id"] != first["id"],
                                  since=mark)["data"]
        for approval in (first, second):
            self.server.call("POST", f"/approve/{approval['id']}", {"decision": "allow"})
        self.assertEqual(sorted([a.result(10)["decision"], b.result(10)["decision"]]), ["allow", "wait"])

    def test_approve_validation(self):
        self.assertEqual(self.server.call("POST", "/approve/nope", {"decision": "allow"})[0], 404)
        mark = self.events.mark()
        held = self.checkout_async("db", "db/valid.sql")
        approval = self.pending("db/valid.sql", mark)
        self.assertEqual(self.server.call("POST", f"/approve/{approval['id']}", {"decision": "yes"})[0], 422)
        self.assertEqual(self.server.call("POST", f"/approve/{approval['id']}", {"decision": "allow"})[0], 200)
        self.assertEqual(self.server.call("POST", f"/approve/{approval['id']}", {"decision": "deny"})[0], 404)
        held.result(10)

    def test_undo_forgets_earlier_approvals(self):
        mark = self.events.mark()
        held = self.checkout_async("db", "db/forget.sql")
        self.server.call("POST", f"/approve/{self.pending('db/forget.sql', mark)['id']}", {"decision": "allow"})
        held.result(10)
        self.hook("db", "Stop")
        self.assertEqual(self.server.call("POST", "/undo/db")[0], 200)
        mark = self.events.mark()
        held = self.checkout_async("db", "db/forget.sql")
        approval = self.pending("db/forget.sql", mark)  # asks again
        self.server.call("POST", f"/approve/{approval['id']}", {"decision": "deny"})
        self.assertEqual(held.result(10)["decision"], "deny")

    def test_guarded_bash_asks_with_the_command_as_target(self):
        mark = self.events.mark()
        command = "echo hi > db/bash.sql"
        held = self.pool.submit(self.checkout, "db", None, "Bash", tool_input={"command": command})
        approval = self.pending(command, mark)
        self.server.call("POST", f"/approve/{approval['id']}", {"decision": "allow"})
        reply = held.result(10)
        self.assertEqual((reply["decision"], reply["file"]), ("allow", None))


class CommitTests(ServerCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server.call("POST", "/hook", {"event": "Plan", "agent": "orchestrator", "ask": "users",
                                          "tasks": [{"agent": "api", "task": 'Add "users"\nendpoint'},
                                                    {"agent": "web", "task": "Users page"}]})

    def test_edit_is_committed_with_trailers_author_and_task(self):
        commit = self.edit_and_commit("api", "api/users.py", "def users():\n    return []\n")
        self.assertEqual((commit["message"], commit["files"]), ("Test commit message", ["api/users.py"]))
        self.assertEqual(commit["task"], 'Add "users"\nendpoint')
        log = git(self.wt["api"], "log", "-1", "--format=%an%n%B")
        self.assertIn("agent api", log)
        self.assertIn("Bullpen-Agent: api", log)
        self.assertIn('Bullpen-Task: Add "users" endpoint', log)  # newline flattened
        top = self.worktree("api")["commits"][0]
        self.assertEqual((top["sha"], top["message"]), (commit["sha"], "Test commit message"))
        self.assertTrue(top["at"])

    def test_lease_is_released_after_the_commit(self):
        mark = self.events.mark()
        self.edit_and_commit("api", "api/release.py", "1\n")
        self.events.wait("claim_released", lambda d: d["file"] == "api/release.py" and d["text"] == "commit", since=mark)
        self.assertIsNone(self.lease("api/release.py"))
        self.assertEqual(self.checkout("web", "api/release.py")["decision"], "allow")

    def test_commit_message_falls_back_when_the_jetson_is_down(self):
        self.jetson.modes["/commit_msg"] = "down"
        self.assertEqual(self.edit_and_commit("api", "api/fallback.py", "1\n")["message"], "Edit api/fallback.py")

    def test_bad_commit_message_reply_also_falls_back(self):
        self.jetson.modes["/commit_msg"] = "bad"
        self.assertEqual(self.edit_and_commit("api", "api/badmsg.py", "1\n")["message"], "Edit api/badmsg.py")

    def test_long_multiline_message_keeps_the_first_line_max_72(self):
        self.jetson.commit_message = "A" * 100 + "\nsecond line"
        self.assertEqual(self.edit_and_commit("api", "api/long.py", "1\n")["message"], "A" * 72)

    def test_unicode_and_quotes_survive(self):
        self.jetson.commit_message = 'Fix "quotes" & ünïcode ✓'
        self.edit_and_commit("web", "web/uni.ts", "1\n")
        self.assertEqual(git(self.wt["web"], "log", "-1", "--format=%s").strip(), 'Fix "quotes" & ünïcode ✓')

    def test_scan_unreachable_still_commits(self):
        self.jetson.modes["/scan"] = "down"  # documented fallback: fails open
        self.edit_and_commit("api", "api/noscan.py", "1\n")

    def test_secret_is_not_committed_and_the_next_checkout_is_denied_once(self):
        mark = self.events.mark()
        before = self.worktree("web")["ahead"]
        self.checkout("web", "web/key.ts")
        self.write("web", "web/key.ts", "const k = 'AKIAABCDEFGHIJKLMNOP'\n")
        self.post_edit("web", "web/key.ts")
        blocked = self.events.wait("secret_blocked", since=mark)["data"]
        self.assertEqual((blocked["agent"], blocked["file"], blocked["kind"]), ("web", "web/key.ts", "aws_key"))
        self.assertEqual(self.worktree("web")["ahead"], before)
        self.assertEqual(git(self.wt["web"], "diff", "--cached", "--name-only").strip(), "")  # unstaged
        self.assertTrue((self.wt["web"] / "web/key.ts").exists())  # the agent's file is not deleted
        denied = self.checkout("web", "web/other.ts")
        self.assertEqual(denied["decision"], "deny")
        self.assertIn("Secret guard", denied["reason"])
        self.assertEqual(self.checkout("web", "web/other.ts")["decision"], "allow")
        (self.wt["web"] / "web/key.ts").unlink()

    def test_no_change_means_no_commit(self):
        mark = self.events.mark()
        before = self.worktree("db")["ahead"]
        self.checkout("db", "docs/README.md")
        self.post_edit("db", "docs/README.md")
        time.sleep(1.5)
        self.assertEqual(self.events.since(mark, "commit"), [])
        self.assertEqual(self.worktree("db")["ahead"], before)

    def test_deleting_a_file_is_committed(self):
        self.edit_and_commit("api", "api/gone.py", "1\n")
        mark = self.events.mark()
        self.checkout("api", "api/gone.py")
        (self.wt["api"] / "api/gone.py").unlink()
        self.post_edit("api", "api/gone.py")
        commit = self.events.wait("commit", lambda d: d["files"] == ["api/gone.py"], since=mark)["data"]
        self.assertIn("D\tapi/gone.py", git(self.wt["api"], "show", "--name-status", "--format=", commit["sha"]))

    def test_new_file_in_new_nested_folders(self):
        self.edit_and_commit("api", "api/deep/er/x.py", "1\n")

    def test_file_name_with_spaces(self):
        self.edit_and_commit("web", "web/my file.ts", "1\n")

    def test_non_edit_tools_do_not_commit(self):
        mark = self.events.mark()
        self.write("db", "docs/bash.md", "made by bash\n")
        self.post_edit("db", "docs/bash.md", tool="Bash")
        time.sleep(1.5)
        self.assertEqual(self.events.since(mark, "commit"), [])
        (self.wt["db"] / "docs/bash.md").unlink()

    def test_parallel_edits_in_one_worktree_all_commit(self):
        mark = self.events.mark()
        files = [f"api/par{i}.py" for i in range(4)]
        for f in files:
            self.checkout("api", f)
            self.write("api", f, f"{f}\n")
        for future in [self.pool.submit(self.post_edit, "api", f) for f in files]:
            future.result(10)
        for f in files:
            self.events.wait("commit", lambda d, f=f: d["files"] == [f], since=mark)
        tracked = git(self.wt["api"], "ls-files", "api").split()
        self.assertTrue(set(files) <= set(tracked))

    def test_commit_lands_on_the_agent_branch_only(self):
        self.edit_and_commit("web", "web/branch.ts", "1\n")
        self.assertIn("web/branch.ts", git(self.repo, "ls-tree", "-r", "--name-only", "agent/web"))
        self.assertNotIn("web/branch.ts", git(self.repo, "ls-tree", "-r", "--name-only", "main"))
        self.assertNotIn("web/branch.ts", git(self.repo, "ls-tree", "-r", "--name-only", "agent/api"))


class UndoMergeTests(ServerCase):
    def test_merge_happy_path(self):
        self.edit_and_commit("api", "api/merge.py", "1\n")
        mark = self.events.mark()
        status, reply = self.server.call("POST", "/merge/api")
        self.assertEqual((status, reply["intent"]), (200, "api intent"))
        api = self.worktree("api")
        self.assertEqual((api["ahead"], api["status"], api["building"]), (0, "done", "bullrunner"))
        self.assertIn("api/merge.py", git(self.repo, "ls-tree", "-r", "--name-only", "main"))
        types = [e["type"] for e in self.events.since(mark)]
        self.assertIn("state", types[types.index("merge") + 1:])  # merge, then the new state
        self.assertEqual(self.checkout("api", "api/after.py")["decision"], "allow")
        self.assertEqual(self.worktree("api")["status"], "working")  # done clears on new work

    def test_merge_with_nothing_to_merge_is_409(self):
        self.assertEqual(self.server.call("POST", "/merge/db")[0], 409)

    def test_merge_conflict_aborts_cleanly(self):
        self.edit_and_commit("api", "shared/conflict.txt", "api version\n")
        self.edit_and_commit("web", "shared/conflict.txt", "web version\n")  # lease was released on commit
        self.assertEqual(self.server.call("POST", "/merge/api")[0], 200)
        main_before = git(self.repo, "rev-parse", "main")
        status, reply = self.server.call("POST", "/merge/web")
        self.assertEqual(status, 409)
        self.assertIn("aborted", reply["detail"])
        self.assertEqual(git(self.repo, "rev-parse", "main"), main_before)
        self.assertEqual(git(self.repo, "status", "--porcelain").strip(), "")
        self.assertFalse((self.repo / ".git" / "MERGE_HEAD").exists())
        self.server.call("POST", "/undo/web")

    def test_merge_without_summary_still_merges(self):
        self.jetson.modes["/summarize"] = "down"
        self.edit_and_commit("db", "docs/nosummary.md", "1\n")
        status, reply = self.server.call("POST", "/merge/db")
        self.assertEqual((status, reply["intent"]), (200, ""))

    def test_undo_resets_the_branch_and_frees_its_leases(self):
        self.edit_and_commit("web", "web/undo.ts", "1\n")
        self.checkout("web", "web/held.ts")
        mark = self.events.mark()
        self.assertEqual(self.server.call("POST", "/undo/web")[0], 200)
        web = self.worktree("web")
        self.assertEqual((web["ahead"], web["building"], web["changed_files"]), (0, "bullrunner", []))
        self.assertFalse((self.wt["web"] / "web/undo.ts").exists())
        self.assertIsNone(self.lease("web/held.ts"))
        released = self.events.since(mark, "claim_released")
        self.assertEqual([e["data"]["text"] for e in released], ["undo"])
        types = [e["type"] for e in self.events.since(mark)]
        self.assertIn("state", types[types.index("undo") + 1:])  # undo, then the new state

    def test_undo_twice_is_safe(self):
        self.assertEqual(self.server.call("POST", "/undo/db")[0], 200)
        self.assertEqual(self.server.call("POST", "/undo/db")[0], 200)

    def test_unknown_agent_is_404(self):
        self.assertEqual(self.server.call("POST", "/undo/ghost")[0], 404)
        self.assertEqual(self.server.call("POST", "/merge/ghost")[0], 404)


class ReadTests(ServerCase):
    agents = ("api", "web", "db", "qa")

    def test_state_order_colors_and_branches(self):
        worktrees = self.state()["worktrees"]
        self.assertEqual([w["agent"] for w in worktrees], ["api", "web", "db", "qa"])
        self.assertEqual([w["color"] for w in worktrees][:3], ["#e5484d", "#3e63dd", "#f5b400"])
        self.assertTrue(worktrees[3]["color"].startswith("#"))
        self.assertEqual(worktrees[3]["branch"], "agent/qa")

    def test_history_spans_agents_newest_first(self):
        self.edit_and_commit("api", "shared/hist.txt", "a\n")
        time.sleep(1.1)  # git orders by commit time in whole seconds
        self.edit_and_commit("web", "shared/hist.txt", "b\n")
        history = self.server.call("GET", "/history?file=shared/hist.txt")[1]
        self.assertEqual([h["agent"] for h in history], ["web", "api"])
        self.assertEqual(set(history[0]), {"sha", "agent", "task", "message", "at"})

    def test_history_of_an_unknown_file_is_empty(self):
        self.assertEqual(self.server.call("GET", "/history?file=nope/none.txt"), (200, []))

    def test_diff_of_a_file_and_a_folder(self):
        self.edit_and_commit("qa", "docs/diff.md", "hello diff\n")
        self.assertIn("+hello diff", self.server.call("GET", "/diff?agent=qa&file=docs/diff.md")[1]["diff"])
        self.assertIn("+hello diff", self.server.call("GET", "/diff?agent=qa&file=docs/")[1]["diff"])
        self.assertEqual(self.server.call("GET", "/diff?agent=qa&file=web/")[1]["diff"], "")

    def test_diff_of_an_unknown_agent_is_404(self):
        self.assertEqual(self.server.call("GET", "/diff?agent=ghost")[0], 404)

    def test_plan_ignores_malformed_tasks(self):
        mark = self.events.mark()
        self.hook("orchestrator", "Plan", ask="x", tasks=["junk", {"task": "no agent"}, {"agent": "qa", "task": "Test it"}])
        plan = self.events.wait("plan", since=mark)["data"]
        self.assertEqual(plan["tasks"], [{"agent": "qa", "task": "Test it"}])
        self.assertEqual(self.worktree("qa")["task"], "Test it")

    def test_plan_without_tasks_is_fine(self):
        self.hook("orchestrator", "Plan")

    def test_empty_and_invalid_bodies(self):
        self.assertEqual(self.server.call("POST", "/checkout", {})[0], 200)
        self.assertEqual(self.server.call("POST", "/hook", {})[0], 200)
        self.assertEqual(self.server.call("POST", "/checkout", raw=b"not json")[0], 422)

    def test_notification_events_are_accepted(self):
        self.hook("api", "Notification", message="waiting for input")

    def test_replay_resends_logged_events_marked_replay(self):
        self.checkout("qa", "docs/replay.md")
        mark = self.events.mark()
        status, reply = self.server.call("GET", "/replay")
        self.assertEqual(status, 200)
        self.assertGreater(reply["events"], 0)
        replayed = wait_until(lambda: [e for e in self.events.since(mark) if e.get("replay")], message="replayed events")
        self.assertTrue(all({"type", "data"} <= set(e) for e in replayed))


class MissingRepoTests(unittest.TestCase):
    """BULLPEN_REPO points nowhere (the empty-campus bug): the server must stay up and say why."""

    @classmethod
    def setUpClass(cls):
        cls.jetson = FakeJetson()
        cls.server = Server(TMP / "does-not-exist", cls.jetson.url)

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.jetson.stop()

    def test_replay_before_any_event_is_404(self):
        self.assertEqual(self.server.call("GET", "/replay")[0], 404)

    def test_health_reports_the_missing_repo(self):
        self.assertFalse(self.server.call("GET", "/health")[1]["repo_found"])

    def test_state_is_empty_with_an_error(self):
        status, state = self.server.call("GET", "/state")
        self.assertEqual((status, state["worktrees"]), (200, []))
        self.assertTrue(state["error"])

    def test_actions_fail_clearly(self):
        self.assertEqual(self.server.call("POST", "/undo/api")[0], 503)
        self.assertEqual(self.server.call("POST", "/merge/api")[0], 503)


class NonAgentWorktreeTests(unittest.TestCase):
    """Worktrees on branches not named agent/* are not agents."""

    def test_only_agent_branches_are_listed(self):
        root = TMP / "nonagent"
        repo, _ = make_demo(root, ("api",))
        git(repo, "worktree", "add", "-q", "-b", "feature/x", str(root / "feature"))
        jetson = FakeJetson()
        server = Server(repo, jetson.url)
        try:
            self.assertEqual([w["agent"] for w in server.call("GET", "/state")[1]["worktrees"]], ["api"])
        finally:
            server.stop()
            jetson.stop()


if __name__ == "__main__":
    unittest.main()
