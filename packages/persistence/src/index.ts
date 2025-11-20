import Database from "better-sqlite3";
import { randomUUID, createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AgentAuth, AgentRecord, AgentRegistrationPayload, ToolConfigSchema } from "@kindred/contracts";
import { z } from "zod";

export type AgentStoreOptions = {
  dbPath: string;
  encryptionKey: string;
};

export type AgentSecretFields = {
  bearerToken?: string | null;
  basicUsername?: string | null;
  basicPassword?: string | null;
  hmacSecret?: string | null;
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
  const updateValidation = db.prepare(`
    UPDATE agents SET validated = @validated, last_validation_error = @error, last_validated_at = @ts
    WHERE id = @id
  `);

  const serializeAuth = (auth: AgentAuth) => {
    switch (auth.type) {
      case "none":
        return { type: "none" };
      case "bearer":
        return {
          type: "bearer",
          bearerToken: auth.bearer_token
        };
      case "basic":
        return {
          type: "basic",
          username: auth.basic.username,
          password: auth.basic.password
        };
      case "hmac":
        return {
          type: "hmac",
          secret: auth.hmac.secret,
          algo: auth.hmac.algo
        };
    }
  };

  const encryptAuth = (auth: AgentAuth) => encodePayload(serializeAuth(auth), key);

  const decryptAuth = (cipherText: string): AgentAuth => {
    const raw = decodePayload(cipherText, key);
    switch (raw.type) {
      case "none":
        return { type: "none" };
      case "bearer":
        return { type: "bearer", bearer_token: raw.bearerToken };
      case "basic":
        return {
          type: "basic",
          basic: { username: raw.username, password: raw.password }
        };
      case "hmac":
        return {
          type: "hmac",
          hmac: { secret: raw.secret, algo: raw.algo }
        };
      default:
        throw new Error("Unknown auth type in payload");
    }
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
    switch (auth.type) {
      case "none":
        return auth;
      case "bearer":
        return { type: "bearer", bearer_token: maskValue(auth.bearer_token) };
      case "basic":
        return {
          type: "basic",
          basic: {
            username: maskValue(auth.basic.username, false),
            password: maskValue(auth.basic.password)
          }
        };
      case "hmac":
        return {
          type: "hmac",
          hmac: {
            algo: auth.hmac.algo,
            secret: maskValue(auth.hmac.secret)
          }
        };
    }
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
    createAgent: (payload: AgentRegistrationPayload) => {
      const now = new Date().toISOString();
      const id = `agt_${randomUUID()}`;
      const tools = validateTools(payload.tools);
      insertStmt.run({
        id,
        name: payload.name,
        endpoint_url: payload.endpoint_url,
        auth_type: payload.auth.type,
        auth_payload: encryptAuth(payload.auth),
        tools_json: JSON.stringify(tools),
        created_at: now,
        validated: 0
      });
      return id;
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
