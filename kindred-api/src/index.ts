import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { createAgentStore } from "@kindred/persistence";
import { createServer } from "./server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from current working directory (package-local .env)
loadEnv();

// Also load project root .env when running via pnpm --filter
const projectRootEnv = path.resolve(__dirname, "../../.env");
if (existsSync(projectRootEnv)) {
  loadEnv({ path: projectRootEnv, override: false });
}

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const PORT = Number(process.env.PORT ?? 4000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.KINDRED_ENCRYPTION_KEY ?? "insecure-dev-key";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
  process.exit(1);
}

const store = createAgentStore({ 
  supabaseUrl: SUPABASE_URL, 
  supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY, 
  encryptionKey: ENCRYPTION_KEY 
});
const app = createServer({ store, logger });

app.listen(PORT, () => {
  logger.info(`kindred-api listening on :${PORT}`);
});
