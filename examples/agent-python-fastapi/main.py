import base64
import hashlib
import hmac
import json
import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request

app = FastAPI()

AUTH_MODE = os.getenv("AUTH_MODE", "bearer")
TOKEN = os.getenv("KINDRED_RUNSTEP_TOKEN", "dev-token")
BASIC_USER = os.getenv("BASIC_USER", "agent")
BASIC_PASS = os.getenv("BASIC_PASS", "super-secret")
HMAC_SECRET = os.getenv("HMAC_SECRET", "kindred-secret")


def _ok(req: Request, raw_body: bytes) -> bool:
    if AUTH_MODE == "none":
        return True
    if AUTH_MODE == "bearer":
        return req.headers.get("authorization") == f"Bearer {TOKEN}"
    if AUTH_MODE == "basic":
        hdr = req.headers.get("authorization", "")
        if hdr.startswith("Basic "):
            decoded = base64.b64decode(hdr.split(" ", 1)[1]).decode()
            return decoded == f"{BASIC_USER}:{BASIC_PASS}"
        return False
    if AUTH_MODE == "hmac":
        sig = req.headers.get("x-kindred-signature", "")
        digest = hmac.new(HMAC_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        return sig == f"sha256={digest}"
    return False


def _pick_tool(tools: Any) -> str:
    if isinstance(tools, list) and tools:
        first = tools[0]
        if isinstance(first, dict) and "name" in first:
            return str(first["name"])
    return "say"


def _safe_args(tool: str) -> Dict[str, Any]:
    if tool == "say":
        return {"message": "ok"}
    return {}


@app.post("/run_step")
async def run_step(req: Request):
    raw = await req.body()
    if not _ok(req, raw):
        raise HTTPException(401, "unauthorized")

    payload = json.loads(raw.decode("utf-8"))
    tool = _pick_tool(payload.get("tools"))
    args = _safe_args(tool)
    return {
        "thought": "Choosing a safe default action.",
        "action": {"tool": tool, "args": args},
    }
