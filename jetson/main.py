import os
import re

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = os.environ.get("JETSON_MODEL", "lfm3:1.7b-q4_K_M")
# ~4 chars per token keeps the prompt well under num_ctx 8192.
MAX_INPUT_CHARS = 12_000

app = FastAPI(title="Bullpen jetson")


class ModelError(Exception):
    pass


@app.exception_handler(ModelError)
def model_error(request: Request, exc: ModelError):
    return JSONResponse(status_code=503, content={"error": str(exc)})


def chat(system: str, user: str, max_tokens: int) -> str:
    try:
        r = httpx.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": MODEL,
                "stream": False,
                "think": False,
                "options": {"num_ctx": 8192, "num_predict": max_tokens, "temperature": 0.2},
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


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check")
def check(event: dict):
    return {"decision": "allow"}


class CommitMsgIn(BaseModel):
    diff: str
    agent: str | None = None


@app.post("/commit_msg")
def commit_msg(body: CommitMsgIn):
    text = chat(
        "Write a one-line git commit message for the diff. Imperative mood, "
        "under 72 characters, no quotes, no period. Reply with the message only.",
        f"Diff:\n{body.diff[:MAX_INPUT_CHARS]}\n\nCommit message:",
        max_tokens=40,
    )
    line = next(l for l in text.splitlines() if l.strip()).strip()
    line = re.sub(r"^(commit message:\s*)", "", line, flags=re.I).strip(" '.")
    if len(line) > 72:
        line = line[:73].rsplit(" ", 1)[0]
    return {"message": line}


class AskIn(BaseModel):
    question: str
    context: str | None = None


@app.post("/ask")
def ask(body: AskIn):
    text = chat(
        "You watch several AI coding agents working in parallel git worktrees. "
        "Answer the question from the context in at most two short plain sentences.",
        f"Context:\n{(body.context or 'none')[-MAX_INPUT_CHARS:]}\n\nQuestion: {body.question}",
        max_tokens=120,
    )
    sentences = re.split(r"(?<=[.!?])\s+", " ".join(text.split()))
    return {"answer": " ".join(sentences[:2])}


# TODO /claim: an agent claims a folder before it edits there.
# TODO /release: the agent releases its claim.
