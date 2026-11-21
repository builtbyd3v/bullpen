from fastapi import FastAPI

app = FastAPI(title="Bullpen jetson")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check")
def check(event: dict):
    return {"decision": "allow"}


# TODO /claim: an agent claims a folder before it edits there.
# TODO /release: the agent releases its claim.
# TODO /commit_msg: write a commit message for a diff with the local model.
# TODO /ask: answer a question from the agents with the local model.
