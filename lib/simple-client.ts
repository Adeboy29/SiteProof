import { createAccount, createClient } from "genlayer-js-stable";
import { studionet } from "genlayer-js-stable/chains";
// Stable Studio uses SDK 1.1.8. The v2 release candidate targets a different consensus deployment.
export function simpleClient(signed = false) {
  if ((process.env.GENLAYER_NETWORK || "studionet") !== "studionet")
    throw Error(
      "This simple app is configured for stable GenLayer Studio. Set GENLAYER_NETWORK=studionet.",
    );
  const key = process.env.GENLAYER_PRIVATE_KEY;
  if (signed && !/^0x[0-9a-fA-F]{64}$/.test(key || ""))
    throw Error("Studio signer is not configured.");
  return createClient({
    chain: studionet,
    ...(signed ? { account: createAccount(key as `0x${string}`) } : {}),
  });
}
export function simpleAddress() {
  const address = process.env.GENLAYER_CONTRACT_ADDRESS;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
    throw Error("Deploy the SiteProof contract first: npm run contract:deploy");
  return address as `0x${string}`;
}
