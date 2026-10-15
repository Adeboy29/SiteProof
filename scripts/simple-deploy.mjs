import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  createAccount,
  createClient,
  generatePrivateKey,
} from "genlayer-js-stable";
import { studionet } from "genlayer-js-stable/chains";
import { TransactionStatus } from "genlayer-js-stable/types";
import { studioReceipt } from "../lib/studio-receipt.ts";
if (!existsSync(".env.local"))
  writeFileSync(".env.local", "GENLAYER_NETWORK=studionet\n");
process.loadEnvFile(".env.local");
if (!process.env.GENLAYER_PRIVATE_KEY) {
  const generated = generatePrivateKey();
  let env = readFileSync(".env.local", "utf8");
  env = /^GENLAYER_PRIVATE_KEY=.*$/m.test(env)
    ? env.replace(
        /^GENLAYER_PRIVATE_KEY=.*$/m,
        "GENLAYER_PRIVATE_KEY=" + generated,
      )
    : env + "\nGENLAYER_PRIVATE_KEY=" + generated;
  writeFileSync(".env.local", env.trim() + "\n");
  process.env.GENLAYER_PRIVATE_KEY = generated;
  console.log("Created a dedicated Studio test signer in ignored .env.local.");
}
const key = process.env.GENLAYER_PRIVATE_KEY;
if (!key) throw Error("Set a dedicated Studio test signer in .env.local.");
const account = createAccount(key),
  client = createClient({ chain: studionet, account });
const code = readFileSync("contracts/siteproof.py", "utf8");
const filename = "deployments/simple-studionet.json";
mkdirSync("deployments", { recursive: true });
let record = existsSync(filename)
  ? JSON.parse(readFileSync(filename, "utf8"))
  : null;
if (record && process.argv.includes("--new")) {
  writeFileSync(
    `deployments/archived-studionet-${Date.now()}.json`,
    JSON.stringify(record, null, 2),
  );
  record = null;
}
if (record && record.signer.toLowerCase() !== account.address.toLowerCase()) {
  writeFileSync(
    "deployments/reference-studionet.json",
    JSON.stringify(record, null, 2),
  );
  record = null;
}
if (
  record &&
  record.sourceHash !== createHash("sha256").update(code).digest("hex")
)
  throw Error(
    "Existing deployment has different code. Review the journal before deploying again.",
  );
if (!record) {
  await client.getContractSchemaForCode(code);
  console.log("Official Studio accepted the contract schema.");
  const hash = await client.deployContract({ code, args: [] });
  record = {
    network: "studionet",
    sdk: "1.1.8",
    signer: account.address,
    sourceHash: createHash("sha256").update(code).digest("hex"),
    hash,
    submittedAt: new Date().toISOString(),
  };
  writeFileSync(filename, JSON.stringify(record, null, 2));
  console.log("Submitted deployment", hash);
}
await client.waitForTransactionReceipt({
  hash: record.hash,
  status: TransactionStatus.FINALIZED,
  interval: 5000,
  retries: 100,
});
const tx = await client.getTransaction({ hash: record.hash }),
  result = studioReceipt(tx);
record.status = result.status;
record.execution = result.successful ? "SUCCESS" : "FAILURE";
writeFileSync(filename, JSON.stringify(record, null, 2));
if (!result.successful)
  throw Error(
    "Deployment not successful: " + record.status + " / " + record.execution,
  );
const address =
  tx.txDataDecoded?.contractAddress || tx.recipient || tx.to_address;
if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
  throw Error("No contract address in finalized receipt.");
const owner = await client.readContract({
  address,
  functionName: "get_owner",
  args: [],
});
if (String(owner).toLowerCase() !== account.address.toLowerCase())
  throw Error("Contract owner does not match signer.");
record.contractAddress = address;
record.verifiedAt = new Date().toISOString();
writeFileSync(filename, JSON.stringify(record, null, 2));
let env = readFileSync(".env.local", "utf8");
for (const [name, value] of Object.entries({
  GENLAYER_NETWORK: "studionet",
  GENLAYER_CONTRACT_ADDRESS: address,
  GENLAYER_MODE: "live",
})) {
  const line = name + "=" + value;
  env = new RegExp("^" + name + "=.*$", "m").test(env)
    ? env.replace(new RegExp("^" + name + "=.*$", "m"), line)
    : env + "\n" + line;
}
writeFileSync(".env.local", env.trim() + "\n");
console.log("Finalized contract", address);
