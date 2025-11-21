# Kindred Platform MVP

Repo containing everything needed to register external agents with Kindred, validate them, and run single `/run_step` rounds from the console.

## Structure

- `kindred-api`: REST API for registering agents, storing secrets, fetching agent detail, and kicking off validation runs.
- `kindred-orchestrator`: Internal service that forwards console "Try a Call" payloads to registered agents.
- `apps/console`: Minimal Next.js console to register agents, view details, validate, and run ad-hoc steps.
- `packages/contracts`: Shared Zod schemas + generated JSON schema + TypeScript types for requests/responses.
- `packages/persistence`: Supabase (PostgreSQL)-backed agent store with AES-GCM encrypted auth payloads.
- `packages/runtime`: Helpers for building validation payloads and invoking agent `/run_step` endpoints with proper auth headers.
- `sdks/node/kindred-agent` and `sdks/python/kindred_agent`: Tiny validators developers can drop into their agents.
- `examples/agent-python-fastapi`, `examples/agent-node-express`: Reference agents covering bearer/basic/hmac auth.
- `docs/quickstart.md`: End-to-end instructions (spin up example agent → register → validate → orchestrator run → tests).

## Getting Started

```bash
pnpm install
pnpm --filter @kindred/contracts build
pnpm --filter @kindred/persistence build
pnpm --filter @kindred/runtime build
```

Then run services (new terminal per command):

```bash
pnpm dev:api
pnpm dev:orchestrator
pnpm dev:console
```

## Environment Variables

Create a `.env` file in the root directory with:

```bash
# Supabase Configuration (service role key is required server-side)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Encryption (used to encrypt stored bearer tokens)
KINDRED_ENCRYPTION_KEY=your-encryption-key-min-16-chars

# Service Ports
PORT=4000
ORCH_PORT=4100
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_ORCH_BASE_URL=http://localhost:4100
```

**Important:** Before running, you need to:
1. Create a Supabase project at https://supabase.com
2. Run the SQL files in `packages/persistence/migrations/` (`001_create_agents_table.sql`, `002_enable_rls_agents.sql`) inside the Supabase SQL editor
3. Copy the **service role** key (Project Settings → API) into `SUPABASE_SERVICE_ROLE_KEY` so the backend can read/write while RLS is enforced

## Quick Usage

1. Start an example agent (see `docs/quickstart.md`).
2. Register via curl or the console. Copy the returned `agent_id`.
3. Validate: `curl -X POST http://localhost:4000/api/agents/<agent_id>/validate`
4. Try a Call via console or `curl` to orchestrator: `http://localhost:4100/internal/orchestrator/run-step`.
5. Run tests: `pnpm test` (contracts + registration/validate auth matrix).

## Run the Example Agent (local demo)

Bring up the Python sample to validate your Kindred setup end-to-end:

```bash
cd examples/agent-python-fastapi
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export KINDRED_BEARER_TOKEN=<token from the console>   # set to your generated token
uvicorn main:app --port 3001
```

Then in the Kindred console:
1. Register the agent with endpoint `http://localhost:3001/run_step`
2. Click **Validate** to ensure the bearer token matches
3. Use **Try a Call** to send manual payloads

## Example Tools JSON

When registering an agent, use this example tools JSON schema:

```json
[
  {
    "name": "say",
    "schema": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "The message to say to the user"
        }
      },
      "required": ["message"]
    }
  }
]
```

## Tech Notes

- All APIs use the shared contracts; invalid payloads produce detailed error strings.
- Secrets are encrypted at rest in Supabase/PostgreSQL (`@kindred/persistence`).
- Runtime invocation includes bearer/basic/hmac headers with signatures where needed.
- Console is intentionally minimal—just enough inputs to hit the endpoints fast.
