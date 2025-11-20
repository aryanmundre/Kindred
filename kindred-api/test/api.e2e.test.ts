import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createServer } from "../src/server";
import { createAgentStore } from "@kindred/persistence";
import express from "express";
import { createServer as createHttpServer } from "http";
import crypto from "crypto";

const sayTool = {
  name: "say",
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"]
  }
};

describe("Kindred API", () => {
  it("registers and validates agents across auth modes", async () => {
    for (const mode of ["none", "bearer", "basic", "hmac"] as const) {
      const mock = await startMockAgent(mode);
      const store = createAgentStore({ dbPath: ":memory:", encryptionKey: "test" });
      const app = createServer({ store });
      const agentResp = await request(app)
        .post("/api/agents")
        .send(payloadFor(mode, mock.url))
        .expect(201);

      const agentId = agentResp.body.agent_id;
      const validation = await request(app).post(`/api/agents/${agentId}/validate`).expect(200);
      expect(validation.body.ok).toBe(true);
      await mock.close();
    }
  });
});

type MockAgent = { url: string; close: () => Promise<void> };

async function startMockAgent(mode: string): Promise<MockAgent> {
  const app = express();
  app.use(express.raw({ type: "*/*" }));
  app.post("/run_step", (req, res) => {
    if (!checkAuth(mode, req, req.body)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const payload = JSON.parse(req.body.toString("utf8"));
    const tool = payload.tools?.[0]?.name ?? "say";
    res.json({ thought: "ok", action: { tool, args: tool === "say" ? { message: "ok" } : {} } });
  });
  const server = createHttpServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("failed to bind mock agent");
  }
  return {
    url: `http://127.0.0.1:${address.port}/run_step`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
  };
}

function checkAuth(mode: string, req: express.Request, raw: Buffer) {
  switch (mode) {
    case "none":
      return true;
    case "bearer":
      return req.headers["authorization"] === "Bearer test-token";
    case "basic":
      return (
        req.headers["authorization"] ===
        `Basic ${Buffer.from("user:pass").toString("base64")}`
      );
    case "hmac":
      const expected = `sha256=${crypto
        .createHmac("sha256", "secret")
        .update(raw)
        .digest("hex")}`;
      return req.headers["x-kindred-signature"] === expected;
    default:
      return false;
  }
}

function payloadFor(mode: string, endpoint: string) {
  const auth: any = { type: mode };
  if (mode === "bearer") auth.bearer_token = "test-token";
  if (mode === "basic") auth.basic = { username: "user", password: "pass" };
  if (mode === "hmac") auth.hmac = { secret: "secret", algo: "sha256" };
  return {
    name: `Agent ${mode}`,
    endpoint_url: endpoint,
    auth,
    tools: [sayTool]
  };
}
