import type { WorldScenario } from "../types";
import { travelBookingScenario } from "./travelBooking";

const registry = new Map<string, WorldScenario>();

const register = (scenario: WorldScenario) => {
  registry.set(scenario.id, scenario);
};

[travelBookingScenario].forEach(register);

export const listScenarios = () => Array.from(registry.values());

export const getScenario = (id: string) => {
  const scenario = registry.get(id);
  if (!scenario) {
    throw new Error(`scenario_not_found:${id}`);
  }
  return scenario;
};

export const registerScenario = (scenario: WorldScenario) => {
  register(scenario);
};

export { travelBookingScenario };

