import { NextResponse } from "next/server";
import { integrationState } from "../../../lib/integration-state";
import { serverDb } from "../../../lib/server";
import { genlayerClient } from "../../../lib/genlayer";
export async function GET() {
  const state = integrationState(process.env);
  let databaseVerified = false,
    contractVerified = false;
  const issues: string[] = [];
  if (state.supabaseConfigured) {
    try {
      const db = await serverDb();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (user) {
        const { error } = await db
          .from("prepared_manifests")
          .select("id")
          .limit(1);
        databaseVerified = !error;
        if (error) issues.push("Required Supabase migrations are unavailable.");
      }
    } catch {
      issues.push("Supabase check failed.");
    }
  }
  if (state.contractConfigured && state.genlayerMode === "genlayer") {
    try {
      const schema = await Promise.race([
        genlayerClient().getContractSchema(
          process.env.GENLAYER_CONTRACT_ADDRESS as `0x${string}`,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Error("timeout")), 8000),
        ),
      ]);
      const serialized = JSON.stringify(schema);
      contractVerified = [
        "assess",
        "get_assessment",
        "get_manifest_hash",
      ].every((name) => serialized.includes(`"${name}"`));
      if (!contractVerified)
        issues.push(
          "The configured contract does not expose the SiteProof interface.",
        );
    } catch {
      issues.push("Configured GenLayer contract could not be verified.");
    }
  }
  return NextResponse.json(
    {
      ...state,
      databaseVerified,
      contractVerified,
      liveVerified:
        state.readyForLiveRequests && databaseVerified && contractVerified,
      issues,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
