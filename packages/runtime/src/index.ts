import fetch from "node-fetch";
import { createHmac } from "crypto";
import {
  AgentAuth,
  HistoryMessageSchema,
  RunStepRequest,
  RunStepRequestSchema,
  RunStepResponse,
  RunStepResponseSchema,
  ToolConfigSchema
} from "@kindred/contracts";

export type InvokeAgentOptions = {
  endpointUrl: string;
  auth: AgentAuth;
  payload: RunStepRequest;
  timeoutMs?: number;
};

export const defaultSayTool = () => ({
  name: "say",
  schema: {
    type: "object",
    properties: {
      message: { type: "string" }
    },
    required: ["message"]
  }
});

export const buildValidationPayload = (tools: unknown, agentId: string): RunStepRequest => {
  const safeTools = ToolConfigSchema.array().min(1).catch([defaultSayTool()]).parse(tools ?? [defaultSayTool()]);
  safeTools[0] = safeTools[0] ?? defaultSayTool();
  const payload: RunStepRequest = {
    history: [
      { role: "system", content: "You are an agent being validated by Kindred" },
      { role: "user", content: "Reply using the provided say tool" }
    ],
    observation: {
      text: "Validation ping",
      dom: null,
      image_b64: null,
      errors: []
    },
    tools: safeTools,
    meta: { run_id: `validate_${agentId}`, step_idx: 0 }
  };
  return RunStepRequestSchema.parse(payload);
};

export async function invokeAgent({ endpointUrl, auth, payload, timeoutMs = 15000 }: InvokeAgentOptions): Promise<RunStepResponse> {
  const parsedPayload = RunStepRequestSchema.parse(payload);
  const body = JSON.stringify(parsedPayload);
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  switch (auth.type) {
    case "bearer":
      headers["authorization"] = `Bearer ${auth.bearer_token}`;
      break;
    case "basic":
      headers["authorization"] = `Basic ${Buffer.from(
        `${auth.basic.username}:${auth.basic.password}`
      ).toString("base64")}`;
      break;
    case "hmac":
      headers["x-kindred-signature"] = `sha256=${createHmac("sha256", auth.hmac.secret)
        .update(body)
        .digest("hex")}`;
      break;
    case "none":
    default:
      break;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Awaited<ReturnType<typeof fetch>>;
  try {
    resp = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("agent_http_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`agent_http_${resp.status}: ${text}`);
  }

  const json = await resp.json();
  return RunStepResponseSchema.parse(json);
}

export const validateHistory = (history: unknown) => HistoryMessageSchema.array().parse(history);
