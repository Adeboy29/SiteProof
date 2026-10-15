import { existsSync } from "node:fs";
import { createClient as supabaseClient } from "@supabase/supabase-js";
import { integrationState } from "../lib/integration-state.ts";
import {
  loadLocalEnv,
  client,
  contractAddress,
  safeError,
} from "./live-common.mjs";
loadLocalEnv();
const state = integrationState(process.env),
  checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "NEEDS SETUP"} ${name}: ${detail}`);
}
record(
  "Supabase configuration",
  state.supabaseConfigured && state.serverCredentialsConfigured,
  "Public project configuration and server credential " +
    (state.supabaseConfigured && state.serverCredentialsConfigured
      ? "are present."
      : "are required."),
);
if (state.supabaseConfigured && state.serverCredentialsConfigured) {
  try {
    const db = supabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    for (const table of [
      "profiles",
      "projects",
      "milestones",
      "prepared_manifests",
      "assessments",
      "genlayer_transactions",
    ]) {
      const { error } = await db.from(table).select("id").limit(1);
      if (error) throw Error(`Migration check failed for ${table}.`);
    }
    const { data, error } = await db.storage.getBucket("evidence");
    record(
      "Database and private storage",
      !error && data?.public === false,
      "Required schema and private evidence bucket " +
        (!error && data?.public === false ? "verified." : "are unavailable."),
    );
  } catch (error) {
    record("Supabase connectivity", false, safeError(error));
  }
}
record(
  "Server test signer",
  state.signerConfigured,
  state.signerConfigured
    ? "Present; private key was not printed."
    : "Configure a dedicated test signer.",
);
try {
  const sdk = client(state.signerConfigured),
    chain = await sdk.getChainId();
  record("GenLayer RPC", true, `${state.network}, chain ID ${chain}`);
  try {
    await sdk.estimateTransactionFees();
    record(
      "Fee API compatibility",
      true,
      "Selected SDK/network fee APIs respond.",
    );
  } catch (error) {
    record(
      "Fee API compatibility",
      false,
      "SDK/network do not expose compatible fee APIs. Use matching Studio-dev RC tooling or the correct stable SDK. " +
        safeError(error),
    );
  }
  if (state.signerConfigured) {
    const balance = await sdk.getBalance({ address: sdk.account.address });
    record(
      "Test signer balance",
      balance > 0n,
      `${sdk.account.address} has ${balance} base units.`,
    );
  }
  if (state.contractConfigured) {
    const address = contractAddress(),
      schema = await sdk.getContractSchema(address),
      text = JSON.stringify(schema);
    record(
      "Deployed SiteProof interface",
      ["assess", "get_assessment", "get_manifest_hash", "get_owner"].every(
        (m) => text.includes(`"${m}"`),
      ),
      address,
    );
    if (state.signerConfigured) {
      const owner = await sdk.readContract({
        address,
        functionName: "get_owner",
        args: [],
      });
      record(
        "Contract signer authorization",
        String(owner).toLowerCase() === sdk.account.address.toLowerCase(),
        "Configured signer " +
          (String(owner).toLowerCase() === sdk.account.address.toLowerCase()
            ? "matches"
            : "does not match") +
          " the contract owner.",
      );
    }
  } else
    record(
      "Deployed contract",
      false,
      "No actual contract address configured.",
    );
} catch (error) {
  record("GenLayer connectivity", false, safeError(error));
}
record(
  "Measured fee profile",
  !!process.env.GENLAYER_FEE_PROFILE_JSON ||
    existsSync(process.env.GENLAYER_FEE_PROFILE_PATH || "fee-profile.json"),
  "Generate from actual finalized Studio profiling receipts.",
);
record(
  "Live assessment mode",
  state.genlayerMode === "genlayer",
  "Current mode: " + state.genlayerMode,
);
if (checks.some((c) => !c.ok)) process.exitCode = 2;
