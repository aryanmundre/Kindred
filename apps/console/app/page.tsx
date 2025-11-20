"use client";

import { useMemo, useState } from "react";
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
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("http://localhost:3001/run_step");
  const [authType, setAuthType] = useState("bearer");
  const [bearer, setBearer] = useState("dev-token");
  const [basicUser, setBasicUser] = useState("agent");
  const [basicPass, setBasicPass] = useState("super-secret");
  const [hmacSecret, setHmacSecret] = useState("kindred-secret");
  const [tools, setTools] = useState(defaultTools);
  const [status, setStatus] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authFields = useMemo(() => {
    if (authType === "bearer") {
      return (
        <label>
          Bearer Token
          <input value={bearer} onChange={(e) => setBearer(e.target.value)} required />
        </label>
      );
    }
    if (authType === "basic") {
      return (
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            Username
            <input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} required />
          </label>
          <label style={{ flex: 1 }}>
            Password
            <input value={basicPass} type="password" onChange={(e) => setBasicPass(e.target.value)} required />
          </label>
        </div>
      );
    }
    if (authType === "hmac") {
      return (
        <label>
          Shared Secret
          <input value={hmacSecret} onChange={(e) => setHmacSecret(e.target.value)} required />
        </label>
      );
    }
    return null;
  }, [authType, bearer, basicUser, basicPass, hmacSecret]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const payload: any = {
        name,
        endpoint_url: endpointUrl,
        auth: { type: authType },
        tools: JSON.parse(tools)
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
      setAgentId(json.agent_id);
      setStatus("Agent registered. Jump into validation →");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Register Agent</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Agent Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Dev Agent" required />
        </label>
        <label>
          /run_step URL
          <input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} required />
        </label>
        <label>
          Auth Mode
          <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
            <option value="none">None</option>
            <option value="bearer">Bearer</option>
            <option value="basic">Basic</option>
            <option value="hmac">HMAC</option>
          </select>
        </label>
        {authFields}
        <label>
          Tools JSON
          <textarea rows={8} value={tools} onChange={(e) => setTools(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register Agent"}
        </button>
      </form>
      {status && (
        <p style={{ marginTop: 16 }}>
          {status}
          {agentId && (
            <> — <a href={`/agent/${agentId}`}>Open Agent Detail</a></>
          )}
        </p>
      )}
    </section>
  );
}
