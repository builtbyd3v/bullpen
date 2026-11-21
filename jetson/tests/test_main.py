import httpx
import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

# Fake secrets are built at runtime so no literal secret lives in the repo.
AWS = "AKIA" + "IOSFODNN7EXAMPL3"
GITHUB = "ghp" + "_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"
ANTHROPIC = "sk-" + "ant-" + "api03-" + "Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2"
OPENAI = "sk-" + "proj-" + "Ab12Cd34Ef56Gh78Ij90Kl12"
SLACK = "xox" + "b-" + "123456789012-abcdefABCDEF"
PEM = "-----BEGIN " + "RSA PRIVATE KEY-----"
ENV_VAL = "q8" + "Zr2Lm5Tx7Wv"
GENERIC = "h7" + "Kd9Lq2Mz4Np6Rs8T"


def check(**body):
    body.setdefault("agent", "api")
    body.setdefault("tool_name", "Edit")
    r = client.post("/check", json=body)
    assert r.status_code == 200
    out = r.json()
    assert set(out) == {"decision", "reason", "rule", "model"}
    assert out["model"] == "rules"
    return out


@pytest.mark.parametrize(
    "path",
    ["db/schema.sql", "db/migrations/001_init.sql", "./db/seed.sql", "/Users/dev/wt/api/db/schema.sql"],
)
def test_check_guarded_file_asks(path):
    out = check(file=path)
    assert out["decision"] == "ask"
    assert out["rule"] == "db/**"
    assert "db/" in out["reason"]


@pytest.mark.parametrize("path", ["api/auth.ts", "web/db.ts", "dbx/a.sql", "/Users/dev/wt/api/src/mongodb.ts"])
def test_check_other_file_allows(path):
    out = check(file=path)
    assert out == {"decision": "allow", "reason": "", "rule": "default", "model": "rules"}


@pytest.mark.parametrize(
    "cmd",
    [
        "touch db/x.sql",
        "echo x >> ./db/seed.sql",
        "echo x > db/x",
        "echo x >db/x",
        "rm -rf db",
        "mv ./db old",
        "cd db && rm -f x",
        "rm /Users/dev/wt/api/db/schema.sql",
        "git checkout main...agent/db -- db/schema.sql",
    ],
)
def test_check_bash_touching_guarded_asks(cmd):
    out = check(tool_name="Bash", command=cmd)
    assert out["decision"] == "ask"
    assert out["rule"] == "db/**"


@pytest.mark.parametrize(
    "cmd",
    [
        "npm test",
        "npm run db:migrate",
        "grep -r mongodb api/",
        "git log agent/db",
        "git diff main...agent/db",
        "git checkout agent/db",
        "git log origin/agent/db --oneline",
    ],
)
def test_check_bash_not_touching_guarded_allows(cmd):
    assert check(tool_name="Bash", command=cmd)["decision"] == "allow"


@pytest.mark.parametrize(
    "cmd",
    [
        "cat db/schema.sql",
        "cat a.ts db/schema.sql | head -5",
        "grep -rn role db/",
        "ls db; cat db/seed.sql",
        "git diff db/schema.sql",
        "cat shared/roles.ts config/roles.json api/users.ts db/schema.sql",
        "cat db/schema.sql 2>/dev/null",
        "grep -n role db/schema.sql 2>&1 | head",
        "find db -name '*.sql'",
        "git log --oneline -- db/",
        "git branch -a",
        "cd db && ls",
    ],
)
def test_check_bash_read_only_on_guarded_allows(cmd):
    assert check(tool_name="Bash", command=cmd)["decision"] == "allow"


@pytest.mark.parametrize(
    "cmd",
    [
        "echo x >> db/schema.sql",
        "cat db/schema.sql > /tmp/x",
        "cat db/schema.sql | tee db/copy.sql",
        "sed -i s/a/b/ db/schema.sql",
        "cat db/schema.sql && rm db/seed.sql",
        "python3 -c \"open('db/schema.sql','w')\"",
        "find db -delete",
        "find db -exec rm {} +",
        "cat $(echo db/schema.sql)",
        "cat `echo db/schema.sql`",
        "cp x db/y",
        "git checkout -- db/schema.sql",
        "git diff --output=db/x",
        "sort -o db/schema.sql db/schema.sql",
        "uniq db/a.sql db/b.sql",
        "FOO=1 cat db/schema.sql",
        "sqlite3 db/app.db",
        "cat db/schema.sql & rm db/seed.sql",
    ],
)
def test_check_bash_write_on_guarded_asks(cmd):
    out = check(tool_name="Bash", command=cmd)
    assert out["decision"] == "ask"
    assert out["rule"] == "db/**"


def test_check_edit_guarded_still_asks():
    assert check(tool_name="Edit", file="db/schema.sql", command="cat db/schema.sql")["decision"] == "ask"


def test_check_missing_file_allows():
    assert check(tool_name="Read")["decision"] == "allow"


def test_check_never_denies_guarded():
    assert check(file="db/x.sql")["decision"] != "deny"


def test_check_malformed_body_is_422():
    assert client.post("/check", json={"file": "db/x"}).status_code == 422


def test_check_guarded_from_env(monkeypatch):
    monkeypatch.setattr(main, "GUARDED", ["db", "infra"])
    out = check(file="infra/main.tf")
    assert out["decision"] == "ask"
    assert out["rule"] == "infra/**"


# ---------- /scan ----------


def diff_for(path, *added, start=1):
    body = "\n".join("+" + a for a in added)
    return f"diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n@@ -0,0 +{start},{len(added)} @@\n{body}\n"


def scan(diff):
    r = client.post("/scan", json={"diff": diff})
    assert r.status_code == 200
    return r.json()


@pytest.mark.parametrize(
    "path,line,kind",
    [
        ("api/aws.py", f'key_id = "{AWS}"', "aws_access_key"),
        ("api/gh.py", f'TOKEN = "{GITHUB}"', "github_token"),
        ("api/llm.py", f'client = Anthropic(api_key="{ANTHROPIC}")', "anthropic_key"),
        ("api/oai.py", f'OpenAI(api_key="{OPENAI}")', "openai_key"),
        ("api/slack.py", f'SLACK = "{SLACK}"', "slack_token"),
        ("api/id_rsa", PEM, "private_key"),
        (".env", f"STRIPE_SECRET_KEY={ENV_VAL}", "env_value"),
        ("api/.env.local", f'export DB_PASSWORD="{ENV_VAL}"', "env_value"),
        ("api/config.py", f'db_password = "{GENERIC}"', "generic_secret"),
        ("web/cfg.ts", f'const apiKey: string = "{GENERIC}";', "generic_secret"),
    ],
)
def test_scan_each_kind(path, line, kind):
    out = scan(diff_for(path, line, start=7))
    assert out["ok"] is False
    assert out["findings"] == [{"file": path, "line": 7, "kind": kind}]


def test_scan_file_and_line_across_files_and_hunks():
    diff = (
        "diff --git a/api/a.py b/api/a.py\n"
        "--- a/api/a.py\n"
        "+++ b/api/a.py\n"
        "@@ -1,3 +1,4 @@\n"
        " import os\n"
        f'-old = "{AWS}"\n'
        "+new = 1\n"
        f'+key = "{AWS}"\n'
        " x = 2\n"
        "@@ -20,2 +21,3 @@ def f():\n"
        " a = 1\n"
        "+b = 2\n"
        f'+tok = "{GITHUB}"\n'
        "diff --git a/web/b.ts b/web/b.ts\n"
        "index 111..222 100644\n"
        "--- a/web/b.ts\n"
        "+++ b/web/b.ts\n"
        "@@ -5 +5,2 @@\n"
        " const a = 1;\n"
        f'+const s = "{SLACK}";\n'
    )
    out = scan(diff)
    assert out["findings"] == [
        {"file": "api/a.py", "line": 3, "kind": "aws_access_key"},
        {"file": "api/a.py", "line": 23, "kind": "github_token"},
        {"file": "web/b.ts", "line": 6, "kind": "slack_token"},
    ]


def test_scan_ignores_removed_lines():
    diff = f'--- a/a.py\n+++ b/a.py\n@@ -1,2 +1 @@\n-key = "{AWS}"\n x = 1\n'
    assert scan(diff) == {"ok": True, "findings": []}


def test_scan_clean_diff_ok():
    assert scan(diff_for("api/a.py", "def add(a, b):", "    return a + b")) == {"ok": True, "findings": []}


@pytest.mark.parametrize(
    "path,line",
    [
        ("api/a.py", 'token = os.environ["API_TOKEN"]'),
        ("api/a.py", 'password = ""'),
        ("api/a.py", 'api_key = os.getenv("OPENAI_API_KEY")'),
        ("web/a.ts", "const apiKey = process.env.API_KEY;"),
        ("web/a.ts", 'const secret = "changeme-changeme";'),
        ("web/a.ts", 'const token = "<your token here>";'),
        (".env", "API_KEY="),
        (".env", "API_KEY=changeme"),
        (".env", "OPENAI_API_KEY=<your key>"),
        (".env", "SECRET_TOKEN=${SECRET_TOKEN}"),
        (".env", "PORT=8600"),
        (".env.example", "API_KEY=your_api_key_here"),
        ("api/auth.ts", 'const TOKEN_HEADER = "x-access-token";'),
        ("api/auth.ts", 'const tokenUrl = "https://auth.usf.edu/oauth/token";'),
        ("api/auth.ts", 'secretsPath = "/var/run/secrets/app"'),
        ("api/cfg.json", '"tokenizer": "bert-base-uncased",'),
        ("web/login.ts", 'const passwordField = "input[name=password]";'),
    ],
)
def test_scan_placeholders_ignored(path, line):
    assert scan(diff_for(path, line))["ok"] is True


def test_scan_never_echoes_secret():
    diff = diff_for("api/a.py", f'k = "{AWS}"', f'p = "{ANTHROPIC}"') + diff_for(".env", f"API_TOKEN={ENV_VAL}")
    r = client.post("/scan", json={"diff": diff})
    for secret in (AWS, ANTHROPIC, ENV_VAL):
        assert secret not in r.text
    assert len(r.json()["findings"]) == 3


# ---------- models ----------


class Calls(list):
    reply = ["Add the login route. It checks tokens. It also logs. Extra."]


@pytest.fixture
def calls(monkeypatch):
    seen = Calls()
    seen.reply = list(Calls.reply)

    def fake_post(url, json=None, timeout=None):
        seen.append((url, json))
        req = httpx.Request("POST", url)
        if url.endswith("/api/embed"):
            n = len(json["input"]) if isinstance(json["input"], list) else 1
            return httpx.Response(200, json={"embeddings": [[1.0, 0.0]] * n}, request=req)
        return httpx.Response(200, json={"message": {"content": seen.reply[0]}}, request=req)

    monkeypatch.setattr(main.httpx, "post", fake_post)
    return seen


@pytest.fixture
def ollama_down(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(main.httpx, "post", boom)


SUMMARY = {"agent": "api", "branch": "agent/api", "diff": "+def login(): ...", "commits": ["Add login route"]}


def test_summarize_happy_path_caps_sentences(calls):
    r = client.post("/summarize", json=SUMMARY)
    assert r.status_code == 200
    assert r.json() == {"intent": "Add the login route. It checks tokens."}
    url, body = calls[0]
    assert url.endswith("/api/chat")
    assert body["model"] == "llama3.2:3b"
    assert "think" not in body
    prompt = body["messages"][-1]["content"]
    assert "agent/api" in prompt and "Add login route" in prompt


def test_summarize_model_failure_503(ollama_down):
    r = client.post("/summarize", json=SUMMARY)
    assert r.status_code == 503
    assert "error" in r.json()


def test_commit_msg_uses_coder_model(calls):
    calls.reply[0] = "Add login route"
    r = client.post("/commit_msg", json={"diff": "+x"})
    assert r.json() == {"message": "Add login route"}
    assert calls[0][1]["model"] == "qwen2.5-coder:3b"
    assert "think" not in calls[0][1]
    assert calls[0][1]["options"]["num_ctx"] == 4096


def test_model_env_override(monkeypatch, calls):
    monkeypatch.setattr(main, "SUMMARIZE_MODEL", "llama3.2:1b")
    client.post("/summarize", json=SUMMARY)
    assert calls[0][1]["model"] == "llama3.2:1b"


def test_ask_short_context_skips_embed(calls):
    calls.reply[0] = "The api agent holds auth.ts."
    r = client.post("/ask", json={"question": "who holds auth.ts?", "context": "api holds auth.ts"})
    assert r.json() == {"answer": "The api agent holds auth.ts."}
    assert [u for u, _ in calls] == [main.OLLAMA_URL + "/api/chat"]
    assert calls[0][1]["model"] == "llama3.2:3b"


def test_ask_long_context_ranks_by_embedding(monkeypatch):
    seen = []
    lines = [f"filler line {i} about nothing in particular" for i in range(300)]
    lines[42] = "web agent is waiting on auth.ts held by api"

    def fake_post(url, json=None, timeout=None):
        seen.append((url, json))
        req = httpx.Request("POST", url)
        if url.endswith("/api/embed"):
            vecs = [[1.0, 0.0] if ("auth.ts" in t) else [0.0, 1.0] for t in json["input"]]
            return httpx.Response(200, json={"embeddings": vecs}, request=req)
        return httpx.Response(200, json={"message": {"content": "Web waits on api."}}, request=req)

    monkeypatch.setattr(main.httpx, "post", fake_post)
    r = client.post("/ask", json={"question": "why is web waiting on auth.ts?", "context": "\n".join(lines)})
    assert r.json() == {"answer": "Web waits on api."}
    embed = [b for u, b in seen if u.endswith("/api/embed")][0]
    assert embed["model"] == "nomic-embed-text"
    prompt = [b for u, b in seen if u.endswith("/api/chat")][0]["messages"][-1]["content"]
    assert "web agent is waiting on auth.ts" in prompt
    assert len(prompt) < main.ASK_CONTEXT_CHARS + 500


def test_ask_embed_failure_falls_back_to_tail(monkeypatch):
    seen = []
    context = "\n".join(f"event {i} happened somewhere" for i in range(500))

    def fake_post(url, json=None, timeout=None):
        req = httpx.Request("POST", url)
        if url.endswith("/api/embed"):
            raise httpx.ConnectError("refused")
        seen.append(json)
        return httpx.Response(200, json={"message": {"content": "Ok."}}, request=req)

    monkeypatch.setattr(main.httpx, "post", fake_post)
    r = client.post("/ask", json={"question": "what happened?", "context": context})
    assert r.status_code == 200
    assert "event 499 happened" in seen[0]["messages"][-1]["content"]


def test_ask_single_long_line_keeps_context(calls):
    calls.reply[0] = "Ok."
    context = "x" * 4000 + " auth.ts held by api"
    client.post("/ask", json={"question": "who holds auth.ts?", "context": context})
    prompt = [b for u, b in calls if u.endswith("/api/chat")][0]["messages"][-1]["content"]
    assert "auth.ts held by api" in prompt


def test_startup_does_not_wait_for_warm(monkeypatch):
    import threading

    gate = threading.Event()
    monkeypatch.setattr(main, "warm", gate.wait)
    with TestClient(main.app) as c:
        assert c.get("/health").json() == {"ok": True}
    gate.set()


def test_reset_ok_when_ollama_down(ollama_down):
    r = client.post("/reset")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["warmed"] == []


def test_reset_warms_every_model(calls):
    r = client.post("/reset")
    assert r.json()["ok"] is True
    assert sorted(r.json()["warmed"]) == ["llama3.2:3b", "nomic-embed-text", "qwen2.5-coder:3b"]
    assert {b["model"] for _, b in calls} == {"llama3.2:3b", "nomic-embed-text", "qwen2.5-coder:3b"}
    for url, body in calls:
        if url.endswith("/api/chat"):
            assert body["options"]["num_ctx"] == 4096


def test_warm_uses_long_timeout_and_num_ctx(monkeypatch):
    seen = []

    def fake_post(url, json=None, timeout=None):
        seen.append((url, json, timeout))
        req = httpx.Request("POST", url)
        if url.endswith("/api/embed"):
            return httpx.Response(200, json={"embeddings": [[1.0]]}, request=req)
        return httpx.Response(200, json={"message": {"content": ""}}, request=req)

    monkeypatch.setattr(main.httpx, "post", fake_post)
    monkeypatch.setattr(main, "NUM_CTX", 2048)
    main.warm()
    assert {t for _, _, t in seen} == {120}
    assert all(b["options"]["num_ctx"] == 2048 for u, b, _ in seen if u.endswith("/api/chat"))


def test_health():
    assert client.get("/health").json() == {"ok": True}
