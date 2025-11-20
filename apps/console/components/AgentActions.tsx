"use client";

import { useState } from "react";
import { API_BASE_URL, ORCH_BASE_URL } from "@/lib/config";

const sampleHistory = JSON.stringify(
  [
    { role: "user", content: "Check latest DOM" }
  ],
  null,
  2
);

const sampleObservation = JSON.stringify(
  {
    text: "Page loaded",
    dom: null,
    image_b64: null,
    errors: []
  },
  null,
  2
);

export default function AgentActions({
  agentId,
  registeredTools
}: {
  agentId: string;
  registeredTools: any[];
}) {
  const [validationOutput, setValidationOutput] = useState<string>("");
  const [historyJson, setHistoryJson] = useState(sampleHistory);
  const [observationJson, setObservationJson] = useState(sampleObservation);
  const [toolsJson, setToolsJson] = useState(JSON.stringify(registeredTools, null, 2));
  const [tryOutput, setTryOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const validateAgent = async () => {
    setBusy(true);
    setValidationOutput("Running validation...");
    try {
      const resp = await fetch(`${API_BASE_URL}/api/agents/${agentId}/validate`, {
        method: "POST"
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.errors?.join(", ") ?? "validate_failed");
      setValidationOutput(JSON.stringify(json, null, 2));
    } catch (err) {
      setValidationOutput((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tryRun = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setBusy(true);
    setTryOutput("Running...");
    try {
      const payload = {
        agent_id: agentId,
        history: JSON.parse(historyJson),
        observation: JSON.parse(observationJson),
        tools: JSON.parse(toolsJson)
      };
      const resp = await fetch(`${ORCH_BASE_URL}/internal/orchestrator/run-step`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? "orchestrator_failed");
      setTryOutput(JSON.stringify(json, null, 2));
    } catch (err) {
      setTryOutput((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3>Validate</h3>
      <button onClick={validateAgent} disabled={busy}>
        Run Validation
      </button>
      {validationOutput && <pre>{validationOutput}</pre>}

      <h3>Try a Call</h3>
      <form onSubmit={tryRun}>
        <label>
          History JSON
          <textarea rows={6} value={historyJson} onChange={(e) => setHistoryJson(e.target.value)} />
        </label>
        <label>
          Observation JSON
          <textarea rows={6} value={observationJson} onChange={(e) => setObservationJson(e.target.value)} />
        </label>
        <label>
          Tools Override (optional)
          <textarea rows={6} value={toolsJson} onChange={(e) => setToolsJson(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Running..." : "Send /run_step"}
        </button>
      </form>
      {tryOutput && <pre>{tryOutput}</pre>}
    </section>
  );
}
