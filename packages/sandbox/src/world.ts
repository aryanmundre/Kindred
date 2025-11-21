import { ObservationSchema, ToolConfigSchema } from "@kindred/contracts";
import { createDeterministicRng, normalizeSeed } from "./rng";
import { TraceRecorder } from "./trace";
import type {
  ScenarioState,
  WorldScenario,
  SandboxToolCall,
  WorldStepResult,
  ScenarioTransitionResult
} from "./types";

export type WorldOptions = {
  seed?: number | string;
  recorder?: TraceRecorder;
};

export class DeterministicWorld<State extends ScenarioState = ScenarioState> {
  #scenario: WorldScenario<State>;
  #rngSeed: number;
  #rng: ReturnType<typeof createDeterministicRng>;
  #state: State;
  #observation = ObservationSchema.parse({
    text: "",
    dom: null,
    image_b64: null,
    errors: []
  });
  #done = false;
  #score = 0;
  #recorder: TraceRecorder;

  constructor(scenario: WorldScenario<State>, options: WorldOptions = {}) {
    this.#scenario = scenario;
    this.#rngSeed = normalizeSeed(options.seed ?? scenario.seed);
    this.#rng = createDeterministicRng(this.#rngSeed);
    this.#state = scenario.createInitialState?.(this.#rngSeed) ?? ({} as State);
    this.#observation = ObservationSchema.parse(scenario.initialObservation);
    this.#recorder = options.recorder ?? new TraceRecorder();
    this.#recorder.recordObservation(this.#observation);
  }

  get scenario() {
    return this.#scenario;
  }

  get observation() {
    return this.#observation;
  }

  get trace() {
    return this.#recorder.snapshot();
  }

  applyTool(call: SandboxToolCall): WorldStepResult<State> {
    if (this.#done) {
      return this.#emitTerminal(call, "world_complete");
    }

    const tools = this.#scenario.tools.map((tool) => ToolConfigSchema.parse(tool));
    const toolNames = new Set(tools.map((tool) => tool.name));
    if (!toolNames.has(call.tool)) {
      return this.#emitTerminal(call, "unknown_tool");
    }

    this.#recorder.recordToolCall(call);
    const result = this.#scenario.transition({
      state: this.#state,
      call,
      rng: this.#rng
    });

    this.#applyTransition(result);

    return {
      observation: this.#observation,
      done: this.#done,
      score: this.#score,
      state: this.#state,
      trace: this.#recorder.snapshot()
    };
  }

  #emitTerminal(call: SandboxToolCall, reason: "world_complete" | "unknown_tool"): WorldStepResult<State> {
    this.#recorder.recordToolCall(call);
    const message =
      reason === "world_complete"
        ? "World already complete; no further tool calls accepted."
        : `Tool "${call.tool}" is not available in this scenario.`;

    const observation = ObservationSchema.parse({
      text: message,
      dom: null,
      image_b64: null,
      errors: [reason]
    });
    this.#recorder.recordObservation(observation);

    return {
      observation,
      done: true,
      score: this.#score,
      state: this.#state,
      trace: this.#recorder.snapshot()
    };
  }

  #applyTransition(result: ScenarioTransitionResult<State>) {
    if (result.nextState) {
      this.#state = result.nextState;
    }
    if (Array.isArray(result.events)) {
      for (const event of result.events) {
        this.#recorder.recordCustom(event);
      }
    }
    if (Array.isArray(result.faults)) {
      for (const fault of result.faults) {
        this.#recorder.recordFault(fault.description, fault.severity ?? "warn");
      }
    }

    this.#observation = ObservationSchema.parse(result.observation);
    this.#recorder.recordObservation(this.#observation);
    this.#done = Boolean(result.done);
    this.#score += result.scoreDelta ?? 0;
  }
}

export const createDeterministicWorld = <State extends ScenarioState = ScenarioState>(
  scenario: WorldScenario<State>,
  options?: WorldOptions
) => new DeterministicWorld<State>(scenario, options);

