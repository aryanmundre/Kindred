import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";

interface Agent {
  agent_id: string;
  name: string;
  endpoint_url: string;
  auth: { type: string };
  tools: any[];
  validated: boolean;
  last_validated_at?: string | null;
  last_validation_error?: string | null;
}

async function getAgents(): Promise<Agent[]> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/agents`, { cache: "no-store" });
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

export default async function AgentListPage() {
  const agents = await getAgents();

  return (
    <div>
      <div className="flex-between mb-6">
        <div>
          <h2 className="section h2" style={{ margin: 0 }}>Registered Agents</h2>
          <p className="text-slate-500 text-sm mt-1">Manage and monitor your agents</p>
        </div>
        <Link href="/register">
          <button>+ New Agent</button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="card empty-state">
          <h3>No agents yet</h3>
          <p>Register your first agent to start orchestrating steps</p>
          <Link href="/register">
            <button>Register Agent</button>
          </Link>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {agents.map((agent) => (
            <Link key={agent.agent_id} href={`/agent/${agent.agent_id}`}>
              <div className="agent-card">
                <div className="flex-between mb-2">
                  <h3>{agent.name}</h3>
                  <span className={`status-badge ${agent.validated ? "validated" : "pending"}`}>
                    {agent.validated ? "✓ Validated" : "Pending"}
                  </span>
                </div>
                <div className="endpoint">{agent.endpoint_url}</div>
                <div className="flex gap-2 mt-4">
                  <span className="text-xs text-slate-500" style={{ padding: "4px 8px", background: "#f1f5f9", borderRadius: "4px" }}>
                    {agent.auth.type}
                  </span>
                  <span className="text-xs text-slate-500" style={{ padding: "4px 8px", background: "#f1f5f9", borderRadius: "4px" }}>
                    {agent.tools.length} tools
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
