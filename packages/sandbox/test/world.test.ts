import { describe, it, expect } from "vitest";
import { createDeterministicWorld, getScenario } from "../src";

describe("DeterministicWorld", () => {
  it("produces deterministic traces for the same seed", () => {
    const scenario = getScenario("travel_booking.v1");
    const worldA = createDeterministicWorld(scenario, { seed: 123 });
    const worldB = createDeterministicWorld(scenario, { seed: 123 });

    const firstStepA = worldA.applyTool({ tool: "search_itineraries", args: { query: "SFO to NYC" } });
    const firstStepB = worldB.applyTool({ tool: "search_itineraries", args: { query: "SFO to NYC" } });

    expect(firstStepA.observation.text).toEqual(firstStepB.observation.text);
    expect(firstStepA.state.selectedOption).toEqual(firstStepB.state.selectedOption);

    const optionToBook = firstStepA.state.selectedOption;
    expect(optionToBook).toBeDefined();

    const finalStepA = worldA.applyTool({
      tool: "book_itinerary",
      args: { option_id: optionToBook, passenger_name: "Alex" }
    });
    const finalStepB = worldB.applyTool({
      tool: "book_itinerary",
      args: { option_id: optionToBook, passenger_name: "Alex" }
    });

    expect(finalStepA.done).toBe(true);
    expect(finalStepB.done).toBe(true);
    expect(finalStepA.observation.text).toEqual(finalStepB.observation.text);
    expect(finalStepA.trace).toEqual(finalStepB.trace);
  });
});

