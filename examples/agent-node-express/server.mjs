import express from "express";
import crypto from "crypto";

const AUTH_MODE = process.env.AUTH_MODE ?? "bearer";
const TOKEN = process.env.KINDRED_RUNSTEP_TOKEN ?? "dev-token";
const BASIC_USER = process.env.BASIC_USER ?? "agent";
const BASIC_PASS = process.env.BASIC_PASS ?? "super-secret";
const HMAC_SECRET = process.env.HMAC_SECRET ?? "kindred-secret";

const app = express();
app.use(express.raw({ type: "*/*" }));

app.post("/run_step", (req, res) => {
  if (!isAuthorized(req, req.body)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const payload = JSON.parse(req.body.toString("utf8"));
    const tool = payload.tools?.[0]?.name ?? "say";
    const args = tool === "say" ? { message: "ok" } : {};
    res.json({
      thought: "Choosing a safe default action.",
      action: { tool, args }
    });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.listen(3001, () => console.log("agent running on :3001"));

function isAuthorized(req, raw) {
  if (AUTH_MODE === "none") return true;
  if (AUTH_MODE === "bearer") {
    return req.headers["authorization"] === `Bearer ${TOKEN}`;
  }
  if (AUTH_MODE === "basic") {
    const header = req.headers["authorization"] ?? "";
    if (!header.startsWith("Basic ")) return false;
    const decoded = Buffer.from(header.split(" ", 1)[1], "base64").toString("utf8");
    return decoded === `${BASIC_USER}:${BASIC_PASS}`;
  }
  if (AUTH_MODE === "hmac") {
    const expected = `sha256=${crypto.createHmac("sha256", HMAC_SECRET).update(raw).digest("hex")}`;
    return req.headers["x-kindred-signature"] === expected;
  }
  return false;
}
