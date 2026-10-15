import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { generatePrivateKey, createAccount } from "genlayer-js";
let muted = false;
const terminalOutput = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
terminalOutput.isTTY = process.stdout.isTTY;
const rl = createInterface({
  input: process.stdin,
  output: terminalOutput,
  terminal: true,
});
async function secret(label) {
  if (!process.stdin.isTTY)
    throw Error("Run setup in your own terminal so secrets are not echoed.");
  const result = rl.question(label);
  muted = true;
  try {
    return await result;
  } finally {
    muted = false;
    process.stdout.write("\n");
  }
}

try {
  console.log(
    "SiteProof live setup. Enter values locally; do not paste secrets into chat.\nCreate a Supabase project first, then find its URL and API keys in its settings.",
  );
  const values = {};
  values.NEXT_PUBLIC_SUPABASE_URL = (
    await rl.question("Supabase project URL: ")
  ).trim();
  new URL(values.NEXT_PUBLIC_SUPABASE_URL);
  values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = (
    await rl.question("Supabase publishable key: ")
  ).trim();
  values.SUPABASE_SERVICE_ROLE_KEY = (
    await secret("Supabase server service-role key (hidden): ")
  ).trim();
  const network =
    (
      await rl.question(
        "GenLayer network [studio-dev / bradbury] (default studio-dev): ",
      )
    ).trim() || "studio-dev";
  if (!["studio-dev", "bradbury"].includes(network))
    throw Error("Choose studio-dev or bradbury.");
  values.GENLAYER_NETWORK = network;
  const existing = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const oldKey = existing
    .match(/^GENLAYER_PRIVATE_KEY=(.+)$/m)?.[1]
    ?.replaceAll('"', "");
  values.GENLAYER_PRIVATE_KEY = oldKey || generatePrivateKey();
  values.GENLAYER_MODE = "development";
  const keep = existing
    .split(/\r?\n/)
    .filter(
      (line) => !Object.keys(values).some((key) => line.startsWith(key + "=")),
    )
    .join("\n");
  for (const value of Object.values(values))
    if (value.includes("\n") || value.includes("\r"))
      throw Error("Multiline values are not allowed.");
  writeFileSync(
    ".env.local",
    keep +
      "\n" +
      Object.entries(values)
        .map(([key, value]) => key + "=" + JSON.stringify(value))
        .join("\n") +
      "\n",
    { mode: 0o600 },
  );
  console.log(
    "Saved only to git-ignored .env.local. Test signer public address:",
    createAccount(values.GENLAYER_PRIVATE_KEY).address,
  );
  console.log(
    "Apply the SQL migrations in Supabase. Then run npm run doctor. Live mode remains disabled until deployment and verification are complete.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
