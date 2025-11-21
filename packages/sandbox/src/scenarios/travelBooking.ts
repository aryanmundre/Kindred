import type { Observation, ToolConfig } from "@kindred/contracts";
import type { WorldScenario, ScenarioTransitionContext, ScenarioTransitionResult, ScenarioState } from "../types";

type TravelBookingState = ScenarioState & {
  selectedOption?: string;
  booked?: boolean;
  remainingQueries: number;
};

const itineraryCatalog = [
  { id: "opt-1", route: "SFO → JFK", depart: "2025-12-01T08:00:00Z", cost: 420 },
  { id: "opt-2", route: "SFO → LGA", depart: "2025-12-01T10:00:00Z", cost: 390 },
  { id: "opt-3", route: "SJC → JFK", depart: "2025-12-02T06:00:00Z", cost: 365 }
] as const;

const travelTools: ToolConfig[] = [
  {
    name: "search_itineraries",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Structured search query, e.g., 'SFO to JFK on Dec 1'"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "book_itinerary",
    schema: {
      type: "object",
      properties: {
        option_id: { type: "string", description: "Identifier from a previous search result" },
        passenger_name: { type: "string" }
      },
      required: ["option_id", "passenger_name"]
    }
  },
  {
    name: "say",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" }
      },
      required: ["message"]
    }
  }
];

const initialObservation: Observation = {
  text: "You are helping Alex book a nonstop flight from SFO to NYC on Dec 1. Use tools to search and then book.",
  dom: null,
  image_b64: null,
  errors: []
};

const createInitialState = (): TravelBookingState => ({
  remainingQueries: 3,
  booked: false,
  selectedOption: undefined
});

const transition = (
  ctx: ScenarioTransitionContext<TravelBookingState>
): ScenarioTransitionResult<TravelBookingState> => {
  switch (ctx.call.tool) {
    case "search_itineraries":
      return handleSearch(ctx);
    case "book_itinerary":
      return handleBooking(ctx);
    case "say":
    default:
      return echoResponse(ctx);
  }
};

const handleSearch = (
  ctx: ScenarioTransitionContext<TravelBookingState>
): ScenarioTransitionResult<TravelBookingState> => {
  if (ctx.state.remainingQueries <= 0) {
    return {
      observation: {
        text: "No more search quota. Proceed to booking or explain failure.",
        dom: null,
        image_b64: null,
        errors: ["search_quota_exceeded"]
      },
      faults: [{ description: "Agent exceeded allotted search calls", severity: "warn" }],
      nextState: ctx.state
    };
  }

  const optionIdx = Math.floor(ctx.rng() * itineraryCatalog.length);
  const option = itineraryCatalog[optionIdx];
  const nextState: TravelBookingState = {
    ...ctx.state,
    remainingQueries: ctx.state.remainingQueries - 1,
    selectedOption: option.id
  };

  return {
    observation: {
      text: `Found option ${option.id}: ${option.route} departing ${option.depart}, cost $${option.cost}.`,
      dom: null,
      image_b64: null,
      errors: []
    },
    events: [
      {
        type: "world",
        label: "search_result",
        detail: {
          option_id: option.id,
          cost: option.cost,
          route: option.route
        }
      }
    ],
    nextState
  };
};

const handleBooking = (
  ctx: ScenarioTransitionContext<TravelBookingState>
): ScenarioTransitionResult<TravelBookingState> => {
  if (ctx.state.booked) {
    return {
      observation: {
        text: "Itinerary already booked. Provide confirmation summary.",
        dom: null,
        image_b64: null,
        errors: []
      },
      nextState: ctx.state,
      faults: [{ description: "duplicate_booking_attempt", severity: "info" }]
    };
  }

  const option = itineraryCatalog.find((item) => item.id === ctx.call.args.option_id);
  if (!option || ctx.call.args.option_id !== ctx.state.selectedOption) {
    return {
      observation: {
        text: "Booking failed. You must first select a valid option via search.",
        dom: null,
        image_b64: null,
        errors: ["missing_selection"]
      },
      faults: [{ description: "booking_without_selection", severity: "warn" }],
      nextState: ctx.state
    };
  }

  const passenger = typeof ctx.call.args.passenger_name === "string" ? ctx.call.args.passenger_name : "Alex";
  const nextState: TravelBookingState = {
    ...ctx.state,
    booked: true
  };

  return {
    observation: {
      text: `Confirmed ${option.route} for ${passenger}. Booking reference #KB-${option.id.toUpperCase()}.`,
      dom: null,
      image_b64: null,
      errors: []
    },
    nextState,
    done: true,
    scoreDelta: 1,
    events: [
      {
        type: "world",
        label: "booking_confirmation",
        detail: { option_id: option.id, passenger }
      }
    ]
  };
};

const echoResponse = (
  ctx: ScenarioTransitionContext<TravelBookingState>
): ScenarioTransitionResult<TravelBookingState> => ({
  observation: {
    text: `Noted: ${ctx.call.args.message ?? ""}`,
    dom: null,
    image_b64: null,
    errors: []
  },
  nextState: ctx.state
});

export const travelBookingScenario: WorldScenario<TravelBookingState> = {
  id: "travel_booking.v1",
  name: "Travel Booking (deterministic)",
  description: "AgentBench-style transactional scenario for flight booking.",
  seed: 7,
  tools: travelTools,
  initialObservation,
  createInitialState,
  transition
};

