#!/usr/bin/env python3
"""Claude Code hook: forward the event to the Bullpen server.

Usage (from .claude/settings.json): python3 bullpen_hook.py <EventName>
Standard library only. Python 3.9+. Contract: shared/events.md.
"""
import json
import os
import sys
import urllib.request

SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8600")


def pre_tool_use(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason,
    }}))


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}
    event = event or payload.get("hook_event_name", "")
    payload["agent"] = os.environ.get("BULLPEN_AGENT", "unknown")
    payload["event"] = event

    try:
        req = urllib.request.Request(
            SERVER_URL.rstrip("/") + "/hook",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            reply = json.load(resp)
        decision = reply["decision"]
        if decision not in ("allow", "deny"):
            raise ValueError(decision)
    except Exception:
        if event == "PreToolUse":
            pre_tool_use("deny", "Bullpen referee offline")
        return

    if event == "PreToolUse":
        pre_tool_use(decision, reply.get("reason", ""))


if __name__ == "__main__":
    main()
