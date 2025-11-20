import { describe, expect, it } from "vitest";
import {
  AgentRegistrationSchema,
  RunStepRequestSchema,
  RunStepResponseSchema
} from "@kindred/contracts";

const sayTool = {
  name: "say",
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"]
  }
};

describe("contracts", () => {
  it("validates run step request", () => {
    const req = RunStepRequestSchema.parse({
      history: [
        { role: "system", content: "hi" },
        { role: "user", content: "ping" }
      ],
      observation: { text: "obs", dom: null, image_b64: null, errors: [] },
      tools: [sayTool],
      meta: { run_id: "run_1", step_idx: 0 }
    });
    expect(req.meta.run_id).toBe("run_1");
  });

  it("flags invalid response", () => {
    expect(() =>
      RunStepResponseSchema.parse({ thought: "", action: { tool: "say" } })
    ).toThrowError();
  });

  it("requires auth payloads for registration", () => {
    expect(() =>
      AgentRegistrationSchema.parse({
        name: "A",
        endpoint_url: "not-a-url",
        auth: { type: "bearer", bearer_token: "" },
        tools: []
      })
    ).toThrow();
  });
});
