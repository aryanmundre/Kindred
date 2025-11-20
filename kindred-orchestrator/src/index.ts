import "dotenv/config";
import pino from "pino";
import { createAgentStore } from "@kindred/persistence";
import { createOrchestratorServer } from "./server";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const PORT = Number(process.env.ORCH_PORT ?? 4100);
const DB_PATH = process.env.KINDRED_DB_PATH ?? "./kindred.db";
const ENCRYPTION_KEY = process.env.KINDRED_ENCRYPTION_KEY ?? "insecure-dev-key";

const store = createAgentStore({ dbPath: DB_PATH, encryptionKey: ENCRYPTION_KEY });
const app = createOrchestratorServer({ store, logger });

app.listen(PORT, () => logger.info(`kindred-orchestrator listening on :${PORT}`));
