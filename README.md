# Kindred Platform MVP

Monorepo containing everything needed to register external agents with Kindred, validate them, and run single `/run_step` rounds from the console.

## Structure

- `kindred-api`: REST API for registering agents, storing secrets, fetching agent detail, and kicking off validation runs.
- `kindred-orchestrator`: Internal service that forwards console "Try a Call" payloads to registered agents.
- `apps/console`: Minimal Next.js console to register agents, view details, validate, and run ad-hoc steps.
- `packages/contracts`: Shared Zod schemas + generated JSON schema + TypeScript types for requests/responses.
- `packages/persistence`: SQLite-backed agent store with AES-GCM encrypted auth payloads.
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

Environment variables live in `.env`; adjust for production (real encryption key, DB path, auth secrets).

## Quick Usage

1. Start an example agent (see `docs/quickstart.md`).
2. Register via curl or the console. Copy the returned `agent_id`.
3. Validate: `curl -X POST http://localhost:4000/api/agents/<agent_id>/validate`
4. Try a Call via console or `curl` to orchestrator: `http://localhost:4100/internal/orchestrator/run-step`.
5. Run tests: `pnpm test` (contracts + registration/validate auth matrix).

## Tech Notes

- All APIs use the shared contracts; invalid payloads produce detailed error strings.
- Secrets are encrypted at rest in SQLite (`@kindred/persistence`).
- Runtime invocation includes bearer/basic/hmac headers with signatures where needed.
- Console is intentionally minimal—just enough inputs to hit the endpoints fast.
