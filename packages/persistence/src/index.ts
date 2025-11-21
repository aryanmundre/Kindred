import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AgentAuth, AgentRecord, AgentRegistrationPayload, ToolConfigSchema } from "@kindred/contracts";
import { z } from "zod";

export type AgentStoreOptions = {
  supabaseUrl: string;
  supabaseServiceKey: string;
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
  validated: boolean;
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

export const createAgentStore = ({ supabaseUrl, supabaseServiceKey, encryptionKey }: AgentStoreOptions) => {
  const key = deriveKey(encryptionKey);
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

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
    validated: row.validated,
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
    createAgent: async (payload: AgentRegistrationPayload): Promise<{ agentId: string; bearerToken: string }> => {
      const now = new Date().toISOString();
      const id = `agt_${randomUUID()}`;
      const bearerToken = generateBearerToken();
      const tools = validateTools(payload.tools);
      const auth: AgentAuth = { type: "bearer", bearer_token: bearerToken };
      
      const { error } = await supabase
        .from("agents")
        .insert({
          id,
          name: payload.name,
          endpoint_url: payload.endpoint_url,
          auth_type: "bearer",
          auth_payload: encryptAuth(auth),
          tools_json: JSON.stringify(tools),
          created_at: now,
          validated: false
        });

      if (error) {
        throw new Error(`Failed to create agent: ${error.message}`);
      }

      return { agentId: id, bearerToken };
    },
    getAgent: async (agentId: string): Promise<AgentRecord & { auth_secrets: AgentAuth }> => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (error || !data) {
        throw new Error("agent_not_found");
      }

      const row = data as AgentRow;
      const secrets = decryptAuth(row.auth_payload);
      return {
        ...toRecord(row),
        auth_secrets: secrets
      };
    },
    getAgentPublic: async (agentId: string): Promise<AgentRecord> => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (error || !data) {
        throw new Error("agent_not_found");
      }

      return toRecord(data as AgentRow);
    },
    listAgents: async (): Promise<AgentRecord[]> => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list agents: ${error.message}`);
      }

      return (data || []).map((row: AgentRow) => toRecord(row));
    },
    updateValidationState: async (agentId: string, ok: boolean, error?: string | null): Promise<void> => {
      const { error: updateError } = await supabase
        .from("agents")
        .update({
          validated: ok,
          last_validation_error: error ?? null,
          last_validated_at: new Date().toISOString()
        })
        .eq("id", agentId);

      if (updateError) {
        throw new Error(`Failed to update validation state: ${updateError.message}`);
      }
    }
  };
};
