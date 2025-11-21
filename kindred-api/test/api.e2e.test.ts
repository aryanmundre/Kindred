import { describe, it, expect } from "vitest";
import request from "supertest";
import { createServer } from "../src/server";
import { createAgentStore } from "@kindred/persistence";
import express from "express";
import { createServer as createHttpServer } from "http";

const sayTool = {
  name: "say",
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"]
  }
};

describe("Kindred API", () => {
  it("registers agent and returns bearer token", async () => {
    const store = createAgentStore({ dbPath: ":memory:", encryptionKey: "test" });
    const app = createServer({ store });
    const agentResp = await request(app)
      .post("/api/agents")
      .send({
        name: "Test Agent",
        endpoint_url: "http://localhost:3001/run_step",
        tools: [sayTool]
      })
      .expect(201);

    expect(agentResp.body.agent_id).toBeDefined();
    expect(agentResp.body.bearer_token).toBeDefined();
    expect(agentResp.body.bearer_token).toMatch(/^kindred_sk_live_/);
    expect(agentResp.body.validated).toBe(false);
  });

  it("validates agent with bearer token", async () => {
    const mock = await startMockAgent();
    const store = createAgentStore({ dbPath: ":memory:", encryptionKey: "test" });
    const app = createServer({ store });
    
    const agentResp = await request(app)
      .post("/api/agents")
      .send({
        name: "Test Agent",
        endpoint_url: mock.url,
        tools: [sayTool]
      })
      .expect(201);

    const agentId = agentResp.body.agent_id;
    const bearerToken = agentResp.body.bearer_token;
    
    // Update mock agent to use the generated token
    mock.setToken(bearerToken);

    const validation = await request(app)
      .post(`/api/agents/${agentId}/validate`)
      .expect(200);
    
    expect(validation.body.ok).toBe(true);
    await mock.close();
  });
});

type MockAgent = { 
  url: string; 
  setToken: (token: string) => void;
  close: () => Promise<void> 
};

async function startMockAgent(): Promise<MockAgent> {
  let expectedToken = "";
  
  const app = express();
  app.use(express.raw({ type: "*/*" }));
  app.post("/run_step", (req, res) => {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const payload = JSON.parse(req.body.toString("utf8"));
    const tool = payload.tools?.[0]?.name ?? "say";
    res.json({ 
      thought: "ok", 
      action: { tool, args: tool === "say" ? { message: "ok" } : {} } 
    });
  });
  
  const server = createHttpServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("failed to bind mock agent");
  }
  
  return {
    url: `http://127.0.0.1:${address.port}/run_step`,
    setToken: (token: string) => {
      expectedToken = token;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
  };
}
