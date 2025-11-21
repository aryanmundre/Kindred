## Kindred Sandbox World – Design Notes

### Goals
- Deterministic offline “world” so the orchestrator can drive `/run_step` cycles without hitting the real browser/filesystem/APIs.
- Tool execution happens inside our process, returns structured outcomes, and deterministically produces the next observation.
- Replayable traces, adversarial perturbations, and safety checks modeled after established evaluation suites.

### External Inspirations
- **AgentBench** (THUDM): scenario manifests + environment adapters + deterministic RNG for reproducible tool feedback. Shows how to encode tasks as JSON/state machines that emit observations after each tool.
- **agent-attack** (ChenWu98): adversarial prompt templates, stochastic fault injectors, and scoring hooks for LLM agents. Highlights fault models (prompt injection, tool corruption) that we can port as optional “world modifiers”.
- **AgentHarm / inspect_evals**: harmful-behavior detection pipeline that tags intermediate agent actions and terminates on safety violations. Provides heuristics + classifier approach for sandbox guard rails.

### Proposed Architecture
1. **`packages/sandbox` workspace package**
   - `WorldScenario` interface: `{ id, name, seed, initial_observation, tools, transition }`.
   - `DeterministicWorld` class: wraps a scenario, seeded PRNG, and event log. Responsible for evaluating tool invocations and generating the next `observation`.
   - `ToolRegistry`: rich metadata (determinism flag, latency model, failure model) + executor callbacks.
   - `TraceRecorder`: serializes `{history, tool_calls, observations, faults}` for later replay.
2. **Scenario definitions**
   - Ship a starter set (`travel_booking`, `database_repair`, `sandbox_attack_vector`) inspired by AgentBench tasks.
   - Each scenario encapsulates state machine transitions + scoring rubric.
3. **Fault / adversary layer**
   - Deterministic injectors (prompt injection from agent-attack, tool response tampering, delayed observation).
   - Configurable via scenario manifest so test runs can opt into stress levels.
4. **Safety evaluators**
   - Hook in AgentHarm-style classifiers (initially heuristic rules) to flag harmful tool calls or outputs. Terminate run or downgrade score.
5. **Integration with orchestrator**
   - New endpoint `POST /internal/orchestrator/run-world-step`.
   - Request includes `scenario_id`, `seed`, `history`, `agent_action`.
   - Orchestrator loads/creates `DeterministicWorld`, executes the tool chosen by the agent, and returns `{observation, world_state, trace_fragment}` instead of invoking external agent.
   - Eventually allow orchestrator to alternate between agent (<->) sandbox via a run loop controller.
6. **CLI utilities**
   - `pnpm sandbox:scenarios` to list available worlds.
   - `pnpm sandbox:run <scenario> --seed=42 --agent-endpoint=http://...` to drive iterative evals.

### Phase 1 Implementation Plan
1. Scaffolding
   - Add `packages/sandbox` with tsconfig + build script.
   - Implement deterministic RNG helper (seeded mulberry32) + base interfaces.
2. Core runtime
   - `createDeterministicWorld(scenario)` returning `{currentObservation, applyTool(toolCall)}`.
   - Basic tool registry with two built-in tools (`search_docs`, `update_record`) to prove out transitions.
3. Scenario examples
   - Encode one small scenario referencing AgentBench “calendar” task structure.
   - Include fixture tests to ensure deterministic behavior given same seed/tool path.
4. Orchestrator wiring
   - Expose sandbox controller module; no API wiring yet, just helper consumed by future endpoints.

### Next Steps
- Flesh out scenario schema loader (JSON manifest + TypeScript DSL).
- Port adversarial prompt templates and parity tests from agent-attack.
- Add safety hooks + scoring summary to traces.
- Connect orchestrator endpoint + console UI to drive sandbox runs end-to-end.


