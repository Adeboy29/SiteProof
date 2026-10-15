import { readFileSync, existsSync } from "node:fs";
import { isSuccessful } from "genlayer-js";
import {
  loadLocalEnv,
  client,
  quote,
  save,
  sourceHash,
  safeError,
} from "./live-common.mjs";
loadLocalEnv();
try {
  const network = process.env.GENLAYER_NETWORK || "studionet",
    filename = `${network}-deployment.json`;
  if (existsSync("deployments/" + filename) && !process.argv.includes("--new"))
    throw Error(
      "A deployment journal already exists. Resume it with npm run genlayer:resume-deploy. Use --new only for an intentional separate deployment.",
    );
  const sdk = client(true);
  const code = new Uint8Array(readFileSync("contracts/siteproof.py"));
  await sdk.getContractSchemaForCode(code);
  const estimate = await quote(sdk, "deploy");
  const record = {
    network,
    sourceHash: sourceHash(),
    status: "submission_started",
    createdAt: new Date().toISOString(),
  };
  save(filename, record);
  console.log("Submitting a real GenLayer test deployment. Network:", network);
  const hash = await sdk.deployContract({
    code,
    args: [],
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  record.transactionHash = hash;
  record.status = "submitted";
  save(filename, record);
  console.log(
    "Transaction submitted:",
    hash,
    "\nWaiting for protocol finalization…",
  );
  const transaction = await sdk.waitForFinalization({
    hash,
    interval: 5000,
    retries: 120,
  });
  record.status = transaction.statusName;
  record.execution = transaction.txExecutionResultName;
  record.lifecycle = transaction.lifecycle;
  if (
    transaction.lifecycle.state !== "finalized" ||
    !isSuccessful(transaction)
  ) {
    save(filename, record);
    throw Error(
      "Deployment did not finalize with successful execution. Inspect the existing transaction; do not redeploy blindly.",
    );
  }
  const address =
    transaction.txDataDecoded?.contractAddress || transaction.recipient;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
    throw Error("No contract address in successful finalized receipt.");
  record.contractAddress = address;
  record.finalizedAt = new Date().toISOString();
  save(filename, record);
  console.log(
    "FINALIZED contract:",
    address,
    "\nSet GENLAYER_CONTRACT_ADDRESS to this address in .env.local.",
  );
} catch (error) {
  console.error(safeError(error));
  process.exitCode = 1;
}
