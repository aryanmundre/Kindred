import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { createAgentStore } from "@kindred/persistence";
import { createOrchestratorServer } from "./server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnv();
const projectRootEnv = path.resolve(__dirname, "../../.env");
if (existsSync(projectRootEnv)) {
  loadEnv({ path: projectRootEnv, override: false });
}

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const PORT = Number(process.env.ORCH_PORT ?? 4100);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ENCRYPTION_KEY = process.env.KINDRED_ENCRYPTION_KEY ?? "insecure-dev-key";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  logger.error("SUPABASE_URL and SUPABASE_KEY environment variables are required");
  process.exit(1);
}

const store = createAgentStore({ 
  supabaseUrl: SUPABASE_URL, 
  supabaseKey: SUPABASE_KEY, 
  encryptionKey: ENCRYPTION_KEY 
});
const app = createOrchestratorServer({ store, logger });

app.listen(PORT, () => logger.info(`kindred-orchestrator listening on :${PORT}`));
