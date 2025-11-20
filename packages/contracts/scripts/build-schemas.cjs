const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
const { zodToJsonSchema } = require("zod-to-json-schema");
const pkgDir = __dirname + "/..";

async function main() {
  const mod = await import(join(pkgDir, "dist/index.js"));
  const schemas = mod.Schemas;
  if (!schemas) {
    throw new Error("Schemas export missing from contracts dist");
  }
  const json = Object.entries(schemas).reduce((acc, [key, schema]) => {
    acc[key] = zodToJsonSchema(schema, key);
    return acc;
  }, {});
  mkdirSync(join(pkgDir, "dist"), { recursive: true });
  writeFileSync(join(pkgDir, "dist/schemas.json"), JSON.stringify(json, null, 2));
  console.log("Contracts JSON schemas written to dist/schemas.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
