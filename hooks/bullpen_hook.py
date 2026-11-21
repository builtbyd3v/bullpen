#!/usr/bin/env python3
"""Claude Code hook: ask the Bullpen server before an edit, report after it.

Usage (from .claude/settings.json): python3 bullpen_hook.py <EventName>
PreToolUse -> POST /checkout, prints the decision. Other events -> POST /hook.
Standard library only. Python 3.9+. Contract: shared/events.md.
"""
import json
import os
import sys
import urllib.request

SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8600")
OFFLINE = "Bullpen referee offline"


def post(path, payload, timeout):
    req = urllib.request.Request(
        SERVER_URL.rstrip("/") + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise ValueError(resp.status)
        return json.load(resp)


def checkout(payload):
    """Map the /checkout reply to (decision, reason). Any failure is a deny."""
    try:
        reply = post("/checkout", payload, float(os.environ.get("BULLPEN_CHECKOUT_TIMEOUT", "70")))
        decision = reply["decision"]
        reason = reply.get("reason") or ""
        if not isinstance(reason, str):
            raise TypeError(reason)
    except Exception:
        return "deny", OFFLINE
    if decision == "allow":
        return "allow", reason
    if decision == "wait":
        return "deny", reason or (
            "%s is held by %s until %s. Work on another file and retry later."
            % (reply.get("file", "this file"), reply.get("holder", "another agent"),
               reply.get("expires_at", "the lease expires"))
        )
    if decision == "ask":
        return "deny", "approval pending"
    if decision == "deny":
        return "deny", reason
    return "deny", OFFLINE


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    event = event or payload.get("hook_event_name", "")
    payload["agent"] = os.environ.get("BULLPEN_AGENT", "unknown")
    payload["event"] = event

    if event == "PreToolUse":
        decision, reason = checkout(payload)
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }}))
        return

    try:
        post("/hook", payload, 3)
    except Exception:
        pass


if __name__ == "__main__":
    main()
