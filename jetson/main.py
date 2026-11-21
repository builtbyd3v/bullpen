import math
import os
import re
import shlex
import threading
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
COMMIT_MODEL = os.environ.get("COMMIT_MODEL", "qwen2.5-coder:3b")
SUMMARIZE_MODEL = os.environ.get("SUMMARIZE_MODEL", "llama3.2:3b")
ASK_MODEL = os.environ.get("ASK_MODEL", "llama3.2:3b")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
GUARDED = [g.strip().strip("/") for g in os.environ.get("BULLPEN_GUARDED", "db").split(",") if g.strip().strip("/")]
BUILDINGS = {"db": "Sun Dome"}
# 4096 lets both 3b chat models and the embedder stay loaded in the Jetson's 8 GB.
NUM_CTX = int(os.environ.get("NUM_CTX", "4096"))
# ~4 chars per token keeps prompt plus output under NUM_CTX 4096.
MAX_INPUT_CHARS = 8_000
# A cold load on the Jetson takes over 60 s; real requests keep 20 s.
WARM_TIMEOUT = 120
# /ask context above this size is ranked by embedding similarity to the question.
ASK_CONTEXT_CHARS = 3_000
ASK_MAX_LINES = 400


def warm() -> list[str]:
    warmed = []
    for model in dict.fromkeys([COMMIT_MODEL, SUMMARIZE_MODEL, ASK_MODEL]):
        # A chat call with no messages only loads the model.
        try:
            httpx.post(
                f"{OLLAMA_URL}/api/chat",
                # Same num_ctx as real calls, or Ollama reloads the model on the first one.
                json={"model": model, "messages": [], "stream": False, "options": {"num_ctx": NUM_CTX}},
                timeout=WARM_TIMEOUT,
            ).raise_for_status()
            warmed.append(model)
        except httpx.HTTPError:
            pass
    try:
        embed(["ok"], timeout=WARM_TIMEOUT)
        warmed.append(EMBED_MODEL)
    except ModelError:
        pass
    return warmed


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=warm, daemon=True).start()
    yield


app = FastAPI(title="Bullpen jetson", lifespan=lifespan)


class ModelError(Exception):
    pass


@app.exception_handler(ModelError)
def model_error(request: Request, exc: ModelError):
    return JSONResponse(status_code=503, content={"error": str(exc)})


def chat(model: str, system: str, user: str, max_tokens: int) -> str:
    try:
        r = httpx.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model,
                "stream": False,
                "options": {"num_ctx": NUM_CTX, "num_predict": max_tokens, "temperature": 0.2},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            timeout=20,
        )
        r.raise_for_status()
        text = r.json()["message"]["content"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise ModelError(f"model call failed: {e!r}")
    text = re.sub(r"[`*#\"]", "", text).strip()
    if not text:
        raise ModelError("model returned no text")
    return text


def embed(texts: list[str], timeout: float = 20) -> list[list[float]]:
    try:
        r = httpx.post(
            f"{OLLAMA_URL}/api/embed",
            json={"model": EMBED_MODEL, "input": texts},
            timeout=timeout,
        )
        r.raise_for_status()
        vecs = r.json()["embeddings"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise ModelError(f"embed call failed: {e!r}")
    if len(vecs) != len(texts):
        raise ModelError("embed returned the wrong count")
    return vecs


def first_sentences(text: str, n: int = 2) -> str:
    return " ".join(re.split(r"(?<=[.!?])\s+", " ".join(text.split()))[:n])


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/reset")
def reset():
    # No per-demo memory lives here yet; reset only pre-warms the models.
    return {"ok": True, "warmed": warm()}


class CheckIn(BaseModel):
    agent: str
    tool_name: str
    file: str | None = None
    command: str | None = None


CMD_START = r"[\s'\"=<>|;&(`]"
CMD_END = r"[\s'\";&|)`]"


READ_ONLY = {
    "cat", "ls", "head", "tail", "grep", "rg", "wc", "pwd", "cd", "echo", "stat", "file", "tree",
    "sort", "uniq", "cut", "diff", "which", "true", "test", "find", "git", "read",
}  # fmt: skip
# Shell keywords that run the command after them; the keyword itself does nothing.
SHELL_PREFIX = {"do", "then", "else", "elif", "while", "until", "if"}
READ_ONLY_GIT = {"log", "diff", "status", "show", "ls-files", "branch", "rev-parse", "blame"}
GIT_BRANCH_READ_FLAGS = {"-a", "-r", "-v", "-vv", "-l", "--list", "--all", "--remotes", "--show-current", "--verbose"}
# Flags that make an allowlisted command write files or run other commands.
WRITE_FLAGS = {
    "find": ("-delete", "-exec", "-execdir", "-ok", "-fprint", "-fls"),
    "sort": ("-o", "--output"),
    "tree": ("-o",),
    "rg": ("--pre",),
    "git": ("--output",),
}


def read_only(command: str) -> bool:
    """True only when every part of the command is a known read. Anything unsure is False."""
    if re.search(r"`|\$\(|<\(", command):
        return False
    # stderr to stdout or to /dev/null writes nothing.
    command = re.sub(r"\d?>&\d|\d?>\s*/dev/null", " ", command)
    if ">" in command:
        return False
    for segment in re.split(r"&&|\|\||[;|&\n]", command):
        try:
            words = shlex.split(segment)
        except ValueError:
            return False
        while words and words[0] in SHELL_PREFIX:
            words = words[1:]
        # `for NAME in WORDS` runs nothing ($(...) was rejected above); done/fi close a block.
        if not words or words[0] in ("for", "done", "fi"):
            continue
        cmd, args = words[0], words[1:]
        if cmd not in READ_ONLY or any(a.startswith(WRITE_FLAGS.get(cmd, ())) for a in args):
            return False
        if cmd == "uniq" and len([a for a in args if not a.startswith("-")]) > 1:
            return False  # uniq IN OUT writes OUT
        if cmd == "git":
            if not args or args[0] not in READ_ONLY_GIT:
                return False
            if args[0] == "branch" and not set(args[1:]) <= GIT_BRANCH_READ_FLAGS:
                return False
    return True


def names_folder(command: str, g: str) -> bool:
    # A path token under the folder, or the bare folder itself.
    # A bare name after a relative prefix (agent/db) is a git ref, not the folder.
    return bool(
        re.search(rf"(?:^|{CMD_START})(?:\S*/)?{re.escape(g)}/", command)
        or re.search(rf"(?:^|{CMD_START})(?:\./|/\S*/)?{re.escape(g)}(?={CMD_END}|$)", command)
    )


def guarded_folder(file: str | None, command: str | None) -> str | None:
    path = "/" + (file or "").strip().replace("\\", "/").removeprefix("./")
    for g in GUARDED:
        if f"/{g}/" in path:
            return g
        # Bash that only reads guarded files needs no approval.
        if command and names_folder(command, g) and not read_only(command):
            return g
    return None


@app.post("/check")
def check(body: CheckIn):
    g = guarded_folder(body.file, body.command)
    if g is None:
        return {"decision": "allow", "reason": "", "rule": "default", "model": "rules"}
    return {
        "decision": "ask",
        "reason": f"{BUILDINGS.get(g, g)} is guarded: {g}/ needs human approval",
        "rule": f"{g}/**",
        "model": "rules",
    }


SECRET_PATTERNS = [
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})")),
    ("anthropic_key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}")),
    ("openai_key", re.compile(r"\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}")),
    ("slack_token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]
ENV_LINE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$")
SECRET_NAME = re.compile(r"KEY|TOKEN|SECRET|PASSWORD|PASSWD", re.I)
GENERIC_SECRET = re.compile(
    r"(?i)(?:secret|token|password|passwd|api_?key)[\w.-]*[\"']?\s*(?::\s*[\w<>\[\]|]+\s*)?(?::|=|:=)\s*[\"']([^\"'\s]{16,})[\"']"
)
PLACEHOLDER = re.compile(r"(?i)changeme|change_me|placeholder|example|your[_ -]|xxxx|dummy|redacted|^<.*>$|^\$\{?\w+\}?$")
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def is_secret_value(value: str) -> bool:
    value = value.strip().strip("\"'")
    return bool(value) and not PLACEHOLDER.search(value)


def line_kinds(path: str, text: str) -> list[str]:
    kinds = [kind for kind, pattern in SECRET_PATTERNS if pattern.search(text)]
    if kinds:
        return kinds
    if os.path.basename(path).startswith(".env"):
        m = ENV_LINE.match(text)
        if m and SECRET_NAME.search(m[1]) and is_secret_value(m[2]):
            return ["env_value"]
        return []
    m = GENERIC_SECRET.search(text)
    # Real secrets mix letters and digits; URLs, paths and header names do not count.
    if m and is_secret_value(m[1]) and re.search(r"\d", m[1]) and re.search(r"[A-Za-z]", m[1]) and not re.search(r"[/:]", m[1]):
        return ["generic_secret"]
    return []


class ScanIn(BaseModel):
    diff: str


@app.post("/scan")
def scan(body: ScanIn):
    findings, path, line, prev = [], None, 0, ""
    for raw in body.diff.splitlines():
        if raw.startswith("+++ ") and prev.startswith("--- "):
            target = raw[4:].split("\t")[0].strip()
            path = None if target == "/dev/null" else target.removeprefix("b/")
        elif m := HUNK.match(raw):
            line = int(m[1])
        elif path and raw.startswith("+"):
            findings += [{"file": path, "line": line, "kind": k} for k in line_kinds(path, raw[1:])]
            line += 1
        elif raw.startswith(" "):
            line += 1
        prev = raw
    return {"ok": not findings, "findings": findings}


class CommitMsgIn(BaseModel):
    diff: str
    agent: str | None = None


@app.post("/commit_msg")
def commit_msg(body: CommitMsgIn):
    text = chat(
        COMMIT_MODEL,
        "Write a one-line git commit message for the diff. Imperative mood, "
        "under 72 characters, no quotes, no period. Reply with the message only.",
        f"Diff:\n{body.diff[:MAX_INPUT_CHARS]}\n\nCommit message:",
        max_tokens=40,
    )
    lines = (re.sub(r"^(commit message:\s*)", "", l.strip(), flags=re.I).strip(" '\"`.") for l in text.splitlines())
    line = next((l for l in lines if l), "")
    if not line:
        raise ModelError("model returned no commit message")
    if len(line) > 72:
        line = line[:72].rsplit(" ", 1)[0]
    return {"message": line}


class SummarizeIn(BaseModel):
    agent: str
    branch: str
    diff: str
    commits: list[str] = []


@app.post("/summarize")
def summarize(body: SummarizeIn):
    commits = "\n".join(f"- {c}" for c in body.commits[-30:]) or "none"
    text = chat(
        SUMMARIZE_MODEL,
        "You read one AI coding agent's git branch. In one or two short plain sentences, "
        "say what the branch set out to do. Reply with the sentences only.",
        f"Agent: {body.agent}\nBranch: {body.branch}\nCommits:\n{commits}\n\n"
        f"Diff:\n{body.diff[:MAX_INPUT_CHARS]}\n\nIntent:",
        max_tokens=100,
    )
    return {"intent": first_sentences(text)}


def cosine(a: list[float], b: list[float]) -> float:
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return sum(x * y for x, y in zip(a, b)) / norm if norm else 0.0


def relevant_context(question: str, context: str) -> str:
    if len(context) <= ASK_CONTEXT_CHARS:
        return context
    lines = [l for l in context.splitlines() if l.strip()][-ASK_MAX_LINES:]
    try:
        q, *vecs = embed([question] + lines)
    except ModelError:
        return context[-MAX_INPUT_CHARS:]
    ranked = sorted(range(len(lines)), key=lambda i: cosine(q, vecs[i]), reverse=True)
    keep, size = set(), 0
    for i in ranked:
        if size + len(lines[i]) + 1 > ASK_CONTEXT_CHARS:
            continue
        keep.add(i)
        size += len(lines[i]) + 1
    if not keep:
        return context[-MAX_INPUT_CHARS:]
    return "\n".join(lines[i] for i in sorted(keep))


class AskIn(BaseModel):
    question: str
    context: str | None = None


@app.post("/ask")
def ask(body: AskIn):
    text = chat(
        ASK_MODEL,
        "You watch several AI coding agents working in parallel git worktrees. "
        "Answer the question from the context in at most two short plain sentences.",
        f"Context:\n{relevant_context(body.question, body.context or 'none')}\n\nQuestion: {body.question}",
        max_tokens=120,
    )
    return {"answer": first_sentences(text)}
