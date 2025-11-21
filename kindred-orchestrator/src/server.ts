import express from "express";
import cors from "cors";
import pino from "pino";
import { OrchestratorRunStepRequestSchema, RunStepRequestSchema } from "@kindred/contracts";
import type { AgentAuth } from "@kindred/contracts";
import { invokeAgent } from "@kindred/runtime";

export type AgentStore = {
  getAgent(agentId: string): Promise<{
    agent_id: string;
    endpoint_url: string;
    tools: any[];
    auth_secrets: AgentAuth;
  }>;
};

export const createOrchestratorServer = (deps: { store: AgentStore; logger?: ReturnType<typeof pino> }) => {
  const { store, logger = pino() } = deps;
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.post("/internal/orchestrator/run-step", async (req, res) => {
    try {
      const payload = OrchestratorRunStepRequestSchema.strict().parse(req.body);
      const agent = await store.getAgent(payload.agent_id);
      const merged = RunStepRequestSchema.parse({
        history: payload.history,
        observation: payload.observation,
        tools: payload.tools && payload.tools.length ? payload.tools : agent.tools,
        meta: {
          run_id: `manual_${payload.agent_id}_${Date.now()}`,
          step_idx: 0
        }
      });

      const response = await invokeAgent({
        endpointUrl: agent.endpoint_url,
        auth: agent.auth_secrets,
        payload: merged
      });
      res.json(response);
    } catch (err) {
      const code = err instanceof Error && err.message === "agent_not_found" ? 404 : 400;
      logger.warn({ err }, "Run-step call failed");
      res.status(code).json({ error: formatError(err) });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
};

function formatError(err: unknown) {
  if (!err) return "unknown_error";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    if ("issues" in err && Array.isArray((err as any).issues)) {
      return (err as any).issues.map((i: any) => i.message).join(", ");
    }
    return err.message;
  }
  return "unknown_error";
}
