import "dotenv/config";
import pino from "pino";
import { createAgentStore } from "@kindred/persistence";
import { createServer } from "./server";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.KINDRED_DB_PATH ?? "./kindred.db";
const ENCRYPTION_KEY = process.env.KINDRED_ENCRYPTION_KEY ?? "insecure-dev-key";

const store = createAgentStore({ dbPath: DB_PATH, encryptionKey: ENCRYPTION_KEY });
const app = createServer({ store, logger });

app.listen(PORT, () => {
  logger.info(`kindred-api listening on :${PORT}`);
});
