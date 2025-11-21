import Database from "better-sqlite3";
import { randomUUID, createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AgentAuth, AgentRecord, AgentRegistrationPayload, ToolConfigSchema } from "@kindred/contracts";
import { z } from "zod";

export type AgentStoreOptions = {
  dbPath: string;
  encryptionKey: string;
};

type AgentRow = {
  id: string;
  name: string;
  endpoint_url: string;
  auth_type: string;
  auth_payload: string;
  tools_json: string;
  created_at: string;
  validated: number;
  last_validation_error: string | null;
  last_validated_at: string | null;
};

const ENC_ALGO = "aes-256-gcm";

const deriveKey = (rawKey: string) => createHash("sha256").update(rawKey).digest();

// Generate a secure bearer token
const generateBearerToken = (): string => {
  // Generate a token like: kindred_sk_live_abc123xyz...
  const randomPart = randomBytes(32).toString("base64url");
  return `kindred_sk_live_${randomPart}`;
};

const encodePayload = (payload: Record<string, unknown>, key: Buffer) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

const decodePayload = (cipherText: string, key: Buffer) => {
  const buf = Buffer.from(cipherText, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
};

export const createAgentStore = ({ dbPath, encryptionKey }: AgentStoreOptions) => {
  const key = deriveKey(encryptionKey);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.prepare(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      auth_payload TEXT NOT NULL,
      tools_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      validated INTEGER DEFAULT 0,
      last_validation_error TEXT,
      last_validated_at TEXT
    )
  `).run();

  const insertStmt = db.prepare(`
    INSERT INTO agents (
      id, name, endpoint_url, auth_type, auth_payload, tools_json, created_at, validated
    ) VALUES (@id, @name, @endpoint_url, @auth_type, @auth_payload, @tools_json, @created_at, @validated)
  `);

  const selectById = db.prepare(`SELECT * FROM agents WHERE id = ?`);
  const selectAll = db.prepare(`SELECT * FROM agents ORDER BY created_at DESC`);
  const updateValidation = db.prepare(`
    UPDATE agents SET validated = @validated, last_validation_error = @error, last_validated_at = @ts
    WHERE id = @id
  `);

  const serializeAuth = (auth: AgentAuth) => {
    if (auth.type !== "bearer") {
      throw new Error("Only bearer token auth is supported");
    }
    return {
      type: "bearer",
      bearerToken: auth.bearer_token
    };
  };

  const encryptAuth = (auth: AgentAuth) => encodePayload(serializeAuth(auth), key);

  const decryptAuth = (cipherText: string): AgentAuth => {
    const raw = decodePayload(cipherText, key);
    if (raw.type !== "bearer") {
      throw new Error("Invalid auth type - only bearer tokens supported");
    }
    return { type: "bearer", bearer_token: raw.bearerToken };
  };

  const toRecord = (row: AgentRow): AgentRecord => ({
    agent_id: row.id,
    name: row.name,
    endpoint_url: row.endpoint_url,
    auth: maskSecrets(decryptAuth(row.auth_payload)),
    tools: JSON.parse(row.tools_json),
    created_at: row.created_at,
    validated: Boolean(row.validated),
    last_validated_at: row.last_validated_at ?? null,
    last_validation_error: row.last_validation_error ?? null
  });

  const maskSecrets = (auth: AgentAuth): AgentAuth => {
    if (auth.type !== "bearer") {
      throw new Error("Only bearer token auth is supported");
    }
    return { type: "bearer", bearer_token: maskValue(auth.bearer_token) };
  };

  const maskValue = (value?: string | null, showTail = true) => {
    if (!value) return "****";
    if (value.length <= 4) return "****";
    return showTail ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : `${value.slice(0, 2)}***`;
  };

  const validateTools = (tools: unknown) => {
    return z.array(ToolConfigSchema).min(1).max(25).parse(tools);
  };

  return {
    createAgent: (payload: AgentRegistrationPayload): { agentId: string; bearerToken: string } => {
      const now = new Date().toISOString();
      const id = `agt_${randomUUID()}`;
      const bearerToken = generateBearerToken();
      const tools = validateTools(payload.tools);
      const auth: AgentAuth = { type: "bearer", bearer_token: bearerToken };
      
      insertStmt.run({
        id,
        name: payload.name,
        endpoint_url: payload.endpoint_url,
        auth_type: "bearer",
        auth_payload: encryptAuth(auth),
        tools_json: JSON.stringify(tools),
        created_at: now,
        validated: 0
      });
      return { agentId: id, bearerToken };
    },
    getAgent: (agentId: string): AgentRecord & { auth_secrets: AgentAuth } => {
      const row = selectById.get(agentId) as AgentRow | undefined;
      if (!row) {
        throw new Error("agent_not_found");
      }
      const secrets = decryptAuth(row.auth_payload);
      return {
        ...toRecord(row),
        auth_secrets: secrets
      };
    },
    getAgentPublic: (agentId: string): AgentRecord => {
      const row = selectById.get(agentId) as AgentRow | undefined;
      if (!row) {
        throw new Error("agent_not_found");
      }
      return toRecord(row);
    },
    listAgents: (): AgentRecord[] => {
      const rows = selectAll.all() as AgentRow[];
      return rows.map(toRecord);
    },
    updateValidationState: (agentId: string, ok: boolean, error?: string | null) => {
      updateValidation.run({
        id: agentId,
        validated: ok ? 1 : 0,
        error: error ?? null,
        ts: new Date().toISOString()
      });
    }
  };
};
