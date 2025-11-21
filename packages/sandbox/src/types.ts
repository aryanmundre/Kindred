import type { Observation, ToolConfig } from "@kindred/contracts";

export type DeterministicRng = () => number;

export type SandboxToolCall = {
  tool: string;
  args: Record<string, unknown>;
  thought?: string;
};

export type ScenarioState = Record<string, unknown>;

export type SandboxEvent =
  | {
      type: "tool_call";
      tool: string;
      args: Record<string, unknown>;
      timestamp: number;
    }
  | {
      type: "observation";
      observation: Observation;
      timestamp: number;
    }
  | {
      type: "world";
      label: string;
      detail?: Record<string, unknown>;
      timestamp: number;
    }
  | {
      type: "fault";
      description: string;
      severity: "info" | "warn" | "error";
      timestamp: number;
    };

export type ScenarioTransitionContext<State extends ScenarioState> = {
  state: State;
  call: SandboxToolCall;
  rng: DeterministicRng;
};

export type ScenarioTransitionResult<State extends ScenarioState> = {
  nextState?: State;
  observation: Observation;
  done?: boolean;
  events?: Array<Omit<SandboxEvent, "timestamp">>;
  scoreDelta?: number;
  faults?: Array<{ description: string; severity?: "info" | "warn" | "error" }>;
};

export interface WorldScenario<State extends ScenarioState = ScenarioState> {
  id: string;
  name: string;
  description: string;
  seed: number;
  tools: ToolConfig[];
  initialObservation: Observation;
  createInitialState?: (seed: number) => State;
  transition: (ctx: ScenarioTransitionContext<State>) => ScenarioTransitionResult<State>;
}

export type WorldStepResult<State extends ScenarioState = ScenarioState> = {
  observation: Observation;
  done: boolean;
  score: number;
  state: State;
  trace: SandboxEvent[];
};

