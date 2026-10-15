import "server-only";
import { readFile } from "node:fs/promises";
import { makeGenlayerClient } from "./genlayer-config";
import { feeOptions, feeProfileSchema } from "./fee-profile";
import { executeSubmission } from "./submission-boundary";
export function genlayerClient(
  network = process.env.GENLAYER_NETWORK || "localnet",
  signed = false,
) {
  const key = signed ? process.env.GENLAYER_PRIVATE_KEY : undefined;
  if (signed && !key) throw Error("Server wallet not configured");
  return makeGenlayerClient(network, key);
}
export async function submitAssessment(id: string, manifest: string) {
  return executeSubmission(
    async () => {
      if (manifest.length > 50000)
        throw Error("Prepared manifest is too large for the contract");
      const address = process.env.GENLAYER_CONTRACT_ADDRESS;
      if (!address?.match(/^0x[0-9a-fA-F]{40}$/))
        throw Error("Contract address not configured");
      const network = process.env.GENLAYER_NETWORK || "localnet",
        client = genlayerClient(network, true),
        call = {
          address: address as `0x${string}`,
          functionName: "assess",
          args: [id, manifest],
        };
      let estimate;
      if (
        process.env.GENLAYER_FEE_PROFILE_JSON ||
        process.env.GENLAYER_FEE_PROFILE_PATH
      ) {
        const raw =
          process.env.GENLAYER_FEE_PROFILE_JSON ||
          (await readFile(process.env.GENLAYER_FEE_PROFILE_PATH!, "utf8"));
        const profile = feeProfileSchema.parse(JSON.parse(raw));
        if (!profile.methods.assess)
          throw Error("Measured assess fee profile missing");
        estimate = await client.estimateTransactionFees(
          feeOptions(profile.methods.assess),
        );
      } else {
        if (network === "bradbury")
          throw Error("Public testnet requires a measured fee profile");
        estimate = await client.estimateTransactionFeesForWrite(call);
      }
      return { client, call, estimate };
    },
    ({ client, call, estimate }) =>
      client.writeContract({
        ...call,
        fees: {
          distribution: estimate.distribution,
          feeValue: estimate.feeValue,
        },
      }),
  );
}
