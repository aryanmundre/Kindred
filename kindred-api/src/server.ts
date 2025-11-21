import express from "express";
import cors from "cors";
import pino from "pino";
import type { Logger } from "pino";
import { AgentRegistrationSchema } from "@kindred/contracts";
import type { AgentAuth } from "@kindred/contracts";
import { buildValidationPayload, defaultSayTool, invokeAgent } from "@kindred/runtime";

export type AgentStore = {
  createAgent(payload: any): Promise<{ agentId: string; bearerToken: string }>;
  getAgent(agentId: string): Promise<{
    agent_id: string;
    name: string;
    endpoint_url: string;
    tools: any[];
    auth_secrets: AgentAuth;
  }>;
  getAgentPublic(agentId: string): Promise<any>;
  listAgents(): Promise<any[]>;
  updateValidationState(agentId: string, ok: boolean, error?: string | null): Promise<void>;
};

export const createServer = (deps: { store: AgentStore; logger?: Logger }) => {
  const { store, logger = pino() } = deps;
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await store.listAgents();
      res.json(agents);
    } catch (err) {
      logger.error({ err }, "Failed to list agents");
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const payload = AgentRegistrationSchema.strict().parse(req.body);
      const { agentId, bearerToken } = await store.createAgent(payload);
      res.status(201).json({ 
        agent_id: agentId, 
        bearer_token: bearerToken,
        validated: false 
      });
    } catch (err) {
      logger.warn({ err }, "Failed to register agent");
      const errorMsg = formatError(err);
      // Include detailed Zod errors if available
      if (err && typeof err === "object" && "issues" in err && Array.isArray((err as any).issues)) {
        res.status(400).json({ 
          error: errorMsg,
          errors: (err as any).issues.map((issue: any) => ({
            path: issue.path,
            message: issue.message
          }))
        });
      } else {
        res.status(400).json({ error: errorMsg });
      }
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const record = await store.getAgentPublic(req.params.id);
      res.json(record);
    } catch (err) {
      if ((err as Error).message === "agent_not_found") {
        res.status(404).json({ error: "agent_not_found" });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/agents/:id/validate", async (req, res) => {
    try {
      const agent = await store.getAgent(req.params.id);
      const payload = buildValidationPayload(agent.tools.length ? agent.tools : [defaultSayTool()], agent.agent_id);
      const response = await invokeAgent({
        endpointUrl: agent.endpoint_url,
        auth: agent.auth_secrets,
        payload
      });
      await store.updateValidationState(agent.agent_id, true, null);
      res.json({ agent_id: agent.agent_id, ok: true, errors: [], response });
    } catch (err) {
      const agentId = req.params.id;
      const errorMsg = formatError(err);
      try {
        await store.updateValidationState(agentId, false, errorMsg);
      } catch (storeErr) {
        logger.error({ storeErr }, "Failed to persist validation failure");
      }
      const status = errorMsg === "agent_not_found" ? 404 : 400;
      res.status(status).json({ agent_id: agentId, ok: false, errors: [errorMsg] });
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
