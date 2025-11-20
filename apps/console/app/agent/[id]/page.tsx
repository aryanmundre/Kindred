import { notFound } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";
import AgentActions from "@/components/AgentActions";

interface AgentRecord {
  agent_id: string;
  name: string;
  endpoint_url: string;
  auth: any;
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
    <section>
      <Link href="/">← Back to Register</Link>
      <h2>{agent.name}</h2>
      <p>
        Agent ID: <code>{agent.agent_id}</code>
      </p>
      <p>
        Endpoint: <code>{agent.endpoint_url}</code>
      </p>
      <p>Status: {agent.validated ? "Validated" : "Pending"}</p>
      {agent.last_validated_at && <p>Last validated: {agent.last_validated_at}</p>}
      {agent.last_validation_error && <p style={{ color: "#dc2626" }}>Last error: {agent.last_validation_error}</p>}

      <section>
        <h3>Auth (masked)</h3>
        <pre>{JSON.stringify(agent.auth, null, 2)}</pre>
      </section>
      <section>
        <h3>Registered Tools</h3>
        <pre>{JSON.stringify(agent.tools, null, 2)}</pre>
      </section>

      <AgentActions agentId={agent.agent_id} registeredTools={agent.tools} />
    </section>
  );
}
