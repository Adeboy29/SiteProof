import { createAccount, createClient } from "genlayer-js";
import {
  localnet,
  studionet,
  studioDevnet,
  testnetBradbury,
} from "genlayer-js/chains";
import { z } from "zod";
export const networkSchema = z.enum([
  "localnet",
  "studionet",
  "studio-dev",
  "bradbury",
]);
export type SupportedNetwork = z.infer<typeof networkSchema>;
export const networkChains = {
  localnet,
  studionet,
  "studio-dev": studioDevnet,
  bradbury: testnetBradbury,
};
export function makeGenlayerClient(network: string, key?: string) {
  const selected = networkSchema.parse(network);
  if (key && !/^0x[0-9a-fA-F]{64}$/.test(key))
    throw Error("Invalid server signer key");
  return createClient({
    chain: networkChains[selected],
    ...(key ? { account: createAccount(key as `0x${string}`) } : {}),
  });
}
export function explorerLink(
  network: string,
  kind: "transaction" | "address",
  value: string,
) {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return null;
  return network === "bradbury"
    ? `https://explorer-bradbury.genlayer.com/${kind === "transaction" ? "tx" : "address"}/${value}`
    : null;
}
