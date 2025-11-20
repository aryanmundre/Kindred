# Kindred MVP Quickstart

Spin up a reference agent, register it with Kindred, validate, and try a call.

## 1. Install dependencies

```bash
pnpm install
```

For Python helpers/tests you can also set up a virtualenv inside `examples/agent-python-fastapi`.

## 2. Start services

```bash
# terminal 1
pnpm dev:api

# terminal 2
pnpm dev:orchestrator

# terminal 3
pnpm dev:console
```

Environment variables:

- `KINDRED_DB_PATH` (default `./kindred.db`)
- `KINDRED_ENCRYPTION_KEY` (required in production)
- `PORT` (Kindred API, default `4000`)
- `ORCH_PORT` (orchestrator, default `4100`)
- `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_ORCH_BASE_URL` (console)

## 3. Run the Python example agent

```bash
cd examples/agent-python-fastapi
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 3001
```

Supported auth modes (`AUTH_MODE=none|bearer|basic|hmac`). Provide matching env vars (`KINDRED_RUNSTEP_TOKEN`, `BASIC_USER`, `BASIC_PASS`, `HMAC_SECRET`).

## 4. Register + validate via curl

```bash
curl -X POST http://localhost:4000/api/agents \
  -H 'content-type: application/json' \
  -d '{
        "name":"FastAPI Dev",
        "endpoint_url":"http://localhost:3001/run_step",
        "auth":{"type":"bearer","bearer_token":"dev-token"},
        "tools":[{"name":"say","schema":{"type":"object","properties":{"message":{"type":"string"}},"required":["message"]}}]
      }'
```

```bash
curl -X POST http://localhost:4000/api/agents/agt_xxx/validate
```

## 5. Try a call from the console

Open `http://localhost:3000` → Register Agent → Validate → "Try a Call".

## 6. Orchestrator direct call

```bash
curl -X POST http://localhost:4100/internal/orchestrator/run-step \
  -H 'content-type: application/json' \
  -d '{
        "agent_id":"agt_xxx",
        "history":[{"role":"user","content":"Ping"}],
        "observation":{"text":"Manual run","dom":null,"image_b64":null,"errors":[]}
      }'
```

## 7. Tests

```bash
pnpm test
```

- Contract schemas validated via Vitest
- Auth mode matrix + registration/validate e2e uses mocked agents
