"use client";

import { useMemo, useState } from "react";
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
  const [authType, setAuthType] = useState("bearer");
  const [bearer, setBearer] = useState("dev-token");
  const [basicUser, setBasicUser] = useState("agent");
  const [basicPass, setBasicPass] = useState("super-secret");
  const [hmacSecret, setHmacSecret] = useState("kindred-secret");
  const [tools, setTools] = useState(defaultTools);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const authFields = useMemo(() => {
    if (authType === "bearer") {
      return (
        <div>
          <label>Bearer Token</label>
          <input
            type="password"
            value={bearer}
            onChange={(e) => setBearer(e.target.value)}
            placeholder="sk_..."
            required
          />
        </div>
      );
    }
    if (authType === "basic") {
      return (
        <div className="grid grid-cols-2">
          <div>
            <label>Username</label>
            <input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={basicPass}
              onChange={(e) => setBasicPass(e.target.value)}
              required
            />
          </div>
        </div>
      );
    }
    if (authType === "hmac") {
      return (
        <div>
          <label>Shared Secret</label>
          <input
            type="password"
            value={hmacSecret}
            onChange={(e) => setHmacSecret(e.target.value)}
            placeholder="Shared secret for HMAC signing"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Used to sign request body with SHA-256</p>
        </div>
      );
    }
    return null;
  }, [authType, bearer, basicUser, basicPass, hmacSecret]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      let parsedTools;
      try {
        parsedTools = JSON.parse(tools);
      } catch {
        setStatus({ type: "error", message: "Invalid Tools JSON" });
        setLoading(false);
        return;
      }

      const payload: any = {
        name,
        endpoint_url: endpointUrl,
        auth: { type: authType },
        tools: parsedTools
      };
      if (authType === "bearer") payload.auth.bearer_token = bearer;
      if (authType === "basic") payload.auth.basic = { username: basicUser, password: basicPass };
      if (authType === "hmac") payload.auth.hmac = { secret: hmacSecret, algo: "sha256" };

      const resp = await fetch(`${API_BASE_URL}/api/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json.error ?? "registration_failed");
      }
      router.push(`/agent/${json.agent_id}`);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h2 className="section h2" style={{ marginTop: 0 }}>Register New Agent</h2>
      <p className="text-slate-500 text-sm mb-6">Configure your agent's endpoint and capabilities</p>

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
          </div>
        </div>

        <div className="section">
          <h3>Authentication</h3>
          <div>
            <label>Auth Type</label>
            <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
              <option value="none">None (Public)</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="hmac">HMAC Signature</option>
            </select>
          </div>
          {authFields}
        </div>

        <div className="section">
          <h3>Tools Definitions</h3>
          <label>Tools JSON Schema</label>
          <textarea
            rows={12}
            value={tools}
            onChange={(e) => setTools(e.target.value)}
            className="json-editor"
          />
        </div>

        {status && (
          <div
            className={`status-badge ${status.type === "error" ? "error" : "validated"}`}
            style={{ display: "block", textAlign: "center", padding: "12px" }}
          >
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
    </div>
  );
}

