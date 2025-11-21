"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";

const defaultTools = JSON.stringify(
  [
    {
      name: "say",
      schema: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"]
      }
    }
  ],
  null,
  2
);

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("http://localhost:3001/run_step");
  const [tools, setTools] = useState(defaultTools);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setLoading(true);
    setStatus(null);
    setGeneratedToken(null);
    setAgentId(null);
    
    // Client-side validation
    if (!name || name.trim().length < 2) {
      setStatus({ type: "error", message: "Agent name must be at least 2 characters" });
      setLoading(false);
      return;
    }
    
    if (!endpointUrl || !endpointUrl.trim()) {
      setStatus({ type: "error", message: "Endpoint URL is required" });
      setLoading(false);
      return;
    }
    
    try {
      new URL(endpointUrl);
    } catch {
      setStatus({ type: "error", message: "Endpoint URL must be a valid URL" });
      setLoading(false);
      return;
    }
    
    let parsedTools;
    try {
      parsedTools = JSON.parse(tools);
      if (!Array.isArray(parsedTools) || parsedTools.length === 0) {
        setStatus({ type: "error", message: "Tools must be a non-empty array" });
        setLoading(false);
        return;
      }
    } catch (err) {
      setStatus({ type: "error", message: `Invalid Tools JSON: ${err instanceof Error ? err.message : "Parse error"}` });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        endpoint_url: endpointUrl.trim(),
        tools: parsedTools
      };

      const resp = await fetch(`${API_BASE_URL}/api/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) {
        // Show more detailed error message
        let errorMsg = json.error || json.message || "Registration failed";
        // If it's a Zod validation error, show the detailed issues
        if (json.errors && Array.isArray(json.errors)) {
          errorMsg = json.errors.map((e: any) => {
            const path = e.path ? e.path.join('.') : 'field';
            return `${path}: ${e.message}`;
          }).join(', ');
        }
        console.error("Registration error details:", JSON.stringify(json, null, 2));
        console.error("Payload sent:", JSON.stringify(payload, null, 2));
        throw new Error(errorMsg);
      }
      setGeneratedToken(json.bearer_token);
      setAgentId(json.agent_id);
      setStatus({ type: "success", message: "Agent registered successfully!" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      alert("Token copied to clipboard!");
    }
  };

  return (
    <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h2 className="section h2" style={{ marginTop: 0 }}>Register New Agent</h2>
      <p className="text-slate-500 text-sm mb-6">Configure your agent's endpoint and capabilities</p>

      {generatedToken ? (
        <div className="section" style={{ background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: "8px", padding: "24px" }}>
          <h3 style={{ marginTop: 0, color: "#16a34a" }}>✓ Agent Registered Successfully!</h3>
          <p className="text-slate-600 mb-4">
            Copy this bearer token and add it to your agent's environment variables. 
            Kindred will use this token to authenticate when calling your agent.
          </p>
          <div style={{ background: "white", padding: "16px", borderRadius: "6px", border: "1px solid #d1d5db", marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "8px", fontWeight: 600 }}>
              BEARER TOKEN
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{ flex: 1, fontSize: "14px", fontFamily: "monospace", wordBreak: "break-all" }}>
                {generatedToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                style={{
                  padding: "8px 16px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Copy
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={() => router.push(`/agent/${agentId}`)}
              style={{
                padding: "10px 20px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              View Agent Details
            </button>
            <button
              type="button"
              onClick={() => {
                setGeneratedToken(null);
                setAgentId(null);
                setStatus(null);
              }}
              className="secondary"
            >
              Register Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="section" style={{ marginTop: 0 }}>
            <h3>General Information</h3>
            <div>
              <label>Agent Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CustomerSupportBot"
                required
              />
            </div>
            <div>
              <label>Endpoint URL (/run_step)</label>
              <input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://api.example.com/agent/run_step"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Your agent's public endpoint. Kindred will call this URL with a bearer token for authentication.
              </p>
            </div>
          </div>

          <div className="section">
            <h3>Tools Definitions</h3>
            <label>Tools JSON Schema</label>
            <textarea
              rows={12}
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              className="json-editor"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Must be a valid JSON array with at least one tool definition
            </p>
          </div>

          {status && (
            <div
              className={`status-badge ${status.type === "error" ? "error" : "validated"}`}
              style={{ 
                display: "block", 
                textAlign: "left", 
                padding: "16px",
                marginBottom: "16px",
                borderRadius: "6px"
              }}
            >
              <strong>{status.type === "error" ? "Error: " : "Success: "}</strong>
              {status.message}
            </div>
          )}

          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="secondary" onClick={() => router.push("/")}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register Agent"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

