"use client";

import { useState } from "react";
import { API_BASE_URL, ORCH_BASE_URL } from "@/lib/config";

const sampleHistory = JSON.stringify(
  [{ role: "user", content: "Hello agent, are you online?" }],
  null,
  2
);

const sampleObservation = JSON.stringify(
  {
    text: "User is waiting for a response.",
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
  const [validationOutput, setValidationOutput] = useState<{ ok: boolean; message: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyJson, setHistoryJson] = useState(sampleHistory);
  const [observationJson, setObservationJson] = useState(sampleObservation);
  const [toolsJson, setToolsJson] = useState(JSON.stringify(registeredTools, null, 2));
  const [tryOutput, setTryOutput] = useState<string>("");
  const [tryLoading, setTryLoading] = useState(false);
  const [tryError, setTryError] = useState<string | null>(null);

  const validateAgent = async () => {
    setValidating(true);
    setValidationOutput(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/agents/${agentId}/validate`, {
        method: "POST"
      });
      const json = await resp.json();
      if (!resp.ok) {
        setValidationOutput({ ok: false, message: json.errors?.join(", ") ?? "Validation failed" });
        return;
      }
      setValidationOutput({ ok: true, message: "Agent validated successfully!" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setValidationOutput({ ok: false, message: (err as Error).message });
    } finally {
      setValidating(false);
    }
  };

  const tryRun = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setTryLoading(true);
    setTryOutput("");
    setTryError(null);
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
      setTryError((err as Error).message);
    } finally {
      setTryLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="flex-between mb-4">
        <h2>Actions</h2>
        <div className="flex gap-2">
          <button onClick={validateAgent} disabled={validating} className="secondary">
            {validating ? "Validating..." : "Validate Connection"}
          </button>
          <button onClick={() => setIsModalOpen(true)}>
            Try a Call
          </button>
        </div>
      </div>

      {validationOutput && (
        <div className={`card status-badge ${validationOutput.ok ? "validated" : "error"}`} style={{ marginBottom: "16px" }}>
          {validationOutput.message}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Orchestrator Playground</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label>History (JSON)</label>
                <textarea
                  rows={6}
                  value={historyJson}
                  onChange={(e) => setHistoryJson(e.target.value)}
                  className="json-editor"
                />
              </div>
              <div>
                <label>Observation (JSON)</label>
                <textarea
                  rows={6}
                  value={observationJson}
                  onChange={(e) => setObservationJson(e.target.value)}
                  className="json-editor"
                />
              </div>
              <div>
                <label>Tools Override (Optional)</label>
                <p className="text-xs text-slate-500 mb-2">Leave empty to use registered tools</p>
                <textarea
                  rows={6}
                  value={toolsJson}
                  onChange={(e) => setToolsJson(e.target.value)}
                  className="json-editor"
                />
              </div>

              <div className="output-console">
                <div className="flex-between mb-4">
                  <span className="text-xs uppercase tracking-wider" style={{ color: "#94a3b8" }}>Output Console</span>
                  <button
                    onClick={tryRun}
                    disabled={tryLoading}
                    style={{ background: "#22c55e", fontSize: "12px", padding: "6px 12px" }}
                  >
                    {tryLoading ? "Running..." : "Run Step →"}
                  </button>
                </div>
                {tryLoading && <div className="info">Waiting for agent response...</div>}
                {tryError && <div className="error">Error: {tryError}</div>}
                {tryOutput && (
                  <div>
                    <div className="success mb-2"># Response</div>
                    <pre style={{ background: "transparent", border: "none", padding: 0, color: "#e2e8f0" }}>{tryOutput}</pre>
                  </div>
                )}
                {!tryLoading && !tryOutput && !tryError && (
                  <div style={{ color: "#64748b", fontStyle: "italic" }}>
                    Ready to run. Configure inputs above and click Run Step.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
