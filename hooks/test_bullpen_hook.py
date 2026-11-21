"""Tests for bullpen_hook.py. Run: python3 -m unittest discover hooks -v

Each test runs the hook as a subprocess against a local stub server.
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bullpen_hook.py")
OFFLINE = "Bullpen referee offline"
EDIT = {
    "session_id": "s1",
    "cwd": "/tmp/demo-api",
    "hook_event_name": "PreToolUse",
    "tool_name": "Edit",
    "tool_input": {"file_path": "/tmp/demo-api/api/users.py"},
}


class Stub:
    """HTTP server that records requests and answers with a fixed reply."""

    def __init__(self, status=200, body=b"{}", delay=0.0):
        self.requests = []
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                stub.requests.append((self.path, json.loads(self.rfile.read(length))))
                time.sleep(delay)
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
                except OSError:
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.url = "http://127.0.0.1:%d" % self.server.server_port
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def free_url():
    """A URL on a port with nothing listening."""
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return "http://127.0.0.1:%d" % port


def run_hook(event, payload, url, agent="api", extra_env=None):
    env = dict(os.environ, SERVER_URL=url)
    env.pop("BULLPEN_CHECKOUT_TIMEOUT", None)
    if agent is None:
        env.pop("BULLPEN_AGENT", None)
    else:
        env["BULLPEN_AGENT"] = agent
    env.update(extra_env or {})
    args = [sys.executable, HOOK] + ([event] if event else [])
    return subprocess.run(
        args, input=json.dumps(payload), capture_output=True, text=True,
        env=env, timeout=30,
    )


class PreToolUseTest(unittest.TestCase):
    def checkout(self, reply, status=200, delay=0.0, extra_env=None, raw=None):
        body = raw if raw is not None else json.dumps(reply).encode()
        stub = Stub(status=status, body=body, delay=delay)
        self.addCleanup(stub.close)
        proc = run_hook("PreToolUse", EDIT, stub.url, extra_env=extra_env)
        self.assertEqual(proc.returncode, 0)
        self.stub = stub
        return proc

    def decision(self, proc):
        out = json.loads(proc.stdout)
        self.assertEqual(set(out), {"hookSpecificOutput"})
        spec = out["hookSpecificOutput"]
        self.assertEqual(spec["hookEventName"], "PreToolUse")
        return spec["permissionDecision"], spec["permissionDecisionReason"]

    def test_allow(self):
        proc = self.checkout({"decision": "allow", "reason": "", "file": "api/users.py",
                              "holder": "api", "expires_at": "2026-11-21T18:01:30Z"})
        self.assertEqual(self.decision(proc), ("allow", ""))

    def test_wait_builds_reason_from_holder_and_expiry(self):
        proc = self.checkout({"decision": "wait", "reason": "", "file": "api/users.py",
                              "holder": "web", "expires_at": "2026-11-21T18:01:30Z"})
        decision, reason = self.decision(proc)
        self.assertEqual(decision, "deny")
        for part in ("api/users.py", "web", "2026-11-21T18:01:30Z", "another file", "retry"):
            self.assertIn(part, reason)

    def test_wait_uses_server_reason_when_given(self):
        proc = self.checkout({"decision": "wait", "reason": "web holds api/users.py",
                              "file": "api/users.py", "holder": "web",
                              "expires_at": "2026-11-21T18:01:30Z"})
        self.assertEqual(self.decision(proc), ("deny", "web holds api/users.py"))

    def test_ask_is_approval_pending(self):
        proc = self.checkout({"decision": "ask", "reason": "Sun Dome is guarded"})
        self.assertEqual(self.decision(proc), ("deny", "approval pending"))

    def test_deny_passes_server_reason(self):
        proc = self.checkout({"decision": "deny", "reason": "db/** needs approval: timeout"})
        self.assertEqual(self.decision(proc), ("deny", "db/** needs approval: timeout"))

    def test_server_down_fails_closed(self):
        proc = run_hook("PreToolUse", EDIT, free_url())
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_bad_json_fails_closed(self):
        proc = self.checkout(None, raw=b"not json")
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_unknown_decision_fails_closed(self):
        proc = self.checkout({"decision": "maybe", "reason": "x"})
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_missing_decision_fails_closed(self):
        proc = self.checkout({"reason": "x"})
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_non_object_reply_fails_closed(self):
        proc = self.checkout(["allow"])
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_http_500_fails_closed(self):
        proc = self.checkout({"decision": "allow"}, status=500)
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_slow_reply_past_timeout_fails_closed(self):
        start = time.monotonic()
        proc = self.checkout({"decision": "allow"}, delay=3,
                             extra_env={"BULLPEN_CHECKOUT_TIMEOUT": "0.5"})
        self.assertLess(time.monotonic() - start, 2.5)
        self.assertEqual(self.decision(proc), ("deny", OFFLINE))

    def test_posts_to_checkout_with_agent_and_event(self):
        self.checkout({"decision": "allow", "reason": ""})
        self.assertEqual(len(self.stub.requests), 1)
        path, body = self.stub.requests[0]
        self.assertEqual(path, "/checkout")
        self.assertEqual(body, dict(EDIT, agent="api", event="PreToolUse"))

    def test_event_falls_back_to_hook_event_name(self):
        stub = Stub(body=json.dumps({"decision": "allow", "reason": ""}).encode())
        self.addCleanup(stub.close)
        proc = run_hook(None, EDIT, stub.url, agent=None)
        self.assertEqual(self.decision(proc), ("allow", ""))
        path, body = stub.requests[0]
        self.assertEqual(path, "/checkout")
        self.assertEqual((body["agent"], body["event"]), ("unknown", "PreToolUse"))


class OtherEventsTest(unittest.TestCase):
    PAYLOADS = {
        "PostToolUse": dict(EDIT, hook_event_name="PostToolUse", tool_response={"ok": True}),
        "Notification": {"session_id": "s1", "cwd": "/tmp", "hook_event_name": "Notification",
                         "message": "needs input"},
        "Stop": {"session_id": "s1", "cwd": "/tmp", "hook_event_name": "Stop"},
    }

    def test_posts_to_hook_and_prints_nothing(self):
        for event, payload in self.PAYLOADS.items():
            with self.subTest(event=event):
                stub = Stub(body=json.dumps({"decision": "deny"}).encode())
                self.addCleanup(stub.close)
                proc = run_hook(event, payload, stub.url)
                self.assertEqual((proc.returncode, proc.stdout), (0, ""))
                self.assertEqual(stub.requests, [("/hook", dict(payload, agent="api", event=event))])

    def test_server_down_never_blocks(self):
        for event, payload in self.PAYLOADS.items():
            with self.subTest(event=event):
                proc = run_hook(event, payload, free_url())
                self.assertEqual((proc.returncode, proc.stdout), (0, ""))

    def test_slow_server_does_not_hang(self):
        stub = Stub(delay=10)
        self.addCleanup(stub.close)
        start = time.monotonic()
        proc = run_hook("Stop", self.PAYLOADS["Stop"], stub.url)
        self.assertLess(time.monotonic() - start, 6)
        self.assertEqual((proc.returncode, proc.stdout), (0, ""))


if __name__ == "__main__":
    unittest.main()
