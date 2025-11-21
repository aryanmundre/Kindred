import { notFound } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";
import AgentActions from "@/components/AgentActions";

interface AgentRecord {
  agent_id: string;
  name: string;
  endpoint_url: string;
  auth?: { type: string; bearer_token?: string };
  tools: any[];
  validated: boolean;
  last_validated_at?: string | null;
  last_validation_error?: string | null;
}

export default async function AgentDetail({ params }: { params: { id: string } }) {
  const resp = await fetch(`${API_BASE_URL}/api/agents/${params.id}`, { cache: "no-store" });
  if (!resp.ok) {
    notFound();
  }
  const agent = (await resp.json()) as AgentRecord;
  
  return (
    <div>
      <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm mb-4 inline-block">
        ← Back to Agents
      </Link>

      <div className="flex-between mb-6">
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            {agent.name}
            <span className={`status-badge ${agent.validated ? "validated" : "pending"}`}>
              {agent.validated ? "✓ Validated" : "Pending"}
            </span>
          </h1>
          <code className="text-slate-500 text-sm">{agent.agent_id}</code>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ gap: "24px", marginBottom: "32px" }}>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Endpoint & Auth
          </h3>
          <div style={{ marginBottom: "16px" }}>
            <label className="text-xs text-slate-500">Endpoint URL</label>
            <div className="endpoint" style={{ marginTop: "4px" }}>{agent.endpoint_url}</div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Auth Mode</label>
            <div className="text-sm font-medium" style={{ marginTop: "4px", textTransform: "capitalize" }}>
              {agent.auth?.type || "bearer"}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Validation Status
          </h3>
          {agent.last_validated_at ? (
            <div>
              <div className="text-sm mb-2">
                Last validated: <span className="text-slate-500">{new Date(agent.last_validated_at).toLocaleString()}</span>
              </div>
              {agent.last_validation_error && (
                <div className="status-badge error" style={{ display: "block", marginTop: "8px" }}>
                  {agent.last_validation_error}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No validation run yet</p>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
          Registered Tools
        </h3>
        <pre style={{ maxHeight: "300px", overflowY: "auto" }}>{JSON.stringify(agent.tools, null, 2)}</pre>
      </div>

      <AgentActions agentId={agent.agent_id} registeredTools={agent.tools} />
    </div>
  );
}
