import { RunStepRequest, RunStepRequestSchema, RunStepResponse, RunStepResponseSchema } from "@kindred/contracts";

export function validateRunStepRequest(payload: unknown): RunStepRequest {
  return RunStepRequestSchema.parse(payload);
}

export function validateRunStepResponse(payload: unknown): RunStepResponse {
  return RunStepResponseSchema.parse(payload);
}

export { RunStepRequest, RunStepResponse };
