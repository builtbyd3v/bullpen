from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Bullpen server")
# The web app runs on another port (5173), so the browser needs CORS headers.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
clients: set[WebSocket] = set()
events: list[dict] = []


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/hook")
async def hook(event: dict):
    events.append(event)
    del events[:-200]
    for ws in list(clients):
        try:
            await ws.send_json(event)
        except Exception:
            clients.discard(ws)
    return {"decision": "allow", "reason": "", "echo": event}


@app.get("/state")
def state():
    return {"events": events}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)
