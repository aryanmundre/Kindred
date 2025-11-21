import type { SandboxEvent, SandboxToolCall } from "./types";
import type { Observation } from "@kindred/contracts";

export class TraceRecorder {
  #events: SandboxEvent[] = [];
  #counter = 0;

  recordToolCall(call: SandboxToolCall) {
    this.#record({
      type: "tool_call",
      tool: call.tool,
      args: call.args
    });
  }

  recordObservation(observation: Observation) {
    this.#record({
      type: "observation",
      observation
    });
  }

  recordWorldEvent(label: string, detail?: Record<string, unknown>) {
    this.#record({
      type: "world",
      label,
      detail
    });
  }

  recordFault(description: string, severity: "info" | "warn" | "error" = "warn") {
    this.#record({
      type: "fault",
      description,
      severity
    });
  }

  recordCustom(event: Omit<SandboxEvent, "timestamp">) {
    this.#record(event);
  }

  snapshot() {
    return this.#events.map((event) => ({ ...event }));
  }

  reset() {
    this.#events = [];
    this.#counter = 0;
  }

  #record(event: Omit<SandboxEvent, "timestamp">) {
    this.#events.push({
      ...event,
      timestamp: this.#counter++
    });
  }
}

