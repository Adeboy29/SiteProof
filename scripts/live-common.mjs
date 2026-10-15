import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { makeGenlayerClient } from "../lib/genlayer-config.ts";
import { feeOptions, feeProfileSchema } from "../lib/fee-profile.ts";
export function loadLocalEnv() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}
export function client(signed = false) {
  const network = process.env.GENLAYER_NETWORK || "studionet";
  const key = signed ? process.env.GENLAYER_PRIVATE_KEY : undefined;
  if (signed && !key)
    throw Error("Configure a dedicated test signer in .env.local first.");
  return makeGenlayerClient(network, key);
}
export function contractAddress() {
  const address = process.env.GENLAYER_CONTRACT_ADDRESS;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
    throw Error("Set the actual deployed GENLAYER_CONTRACT_ADDRESS first.");
  return address;
}
export function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}
export function stringify(value) {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}
export function save(filename, value) {
  mkdirSync("deployments", { recursive: true });
  writeFileSync(resolve("deployments", filename), stringify(value) + "\n");
}
export function sourceHash() {
  return hash(readFileSync("contracts/siteproof.py"));
}
export async function quote(client, method) {
  const raw =
    process.env.GENLAYER_FEE_PROFILE_JSON ||
    (existsSync(process.env.GENLAYER_FEE_PROFILE_PATH || "fee-profile.json")
      ? readFileSync(
          process.env.GENLAYER_FEE_PROFILE_PATH || "fee-profile.json",
          "utf8",
        )
      : null);
  if (!raw)
    throw Error(
      "Generate fee-profile.json with the official Studio profiling test before deployment. No measured fee quantities are invented.",
    );
  const profile = feeProfileSchema.parse(JSON.parse(raw)),
    entry = method === "deploy" ? profile.deploy : profile.methods[method];
  if (!entry) throw Error(`Measured ${method} profile missing.`);
  return client.estimateTransactionFees(feeOptions(entry));
}
export function safeError(error) {
  let message = error?.shortMessage || error?.message || "Operation failed";
  for (const key of [
    "GENLAYER_PRIVATE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]) {
    const secret = process.env[key];
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return message;
}
