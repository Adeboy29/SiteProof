import { readFileSync } from "node:fs";
import { isSuccessful } from "genlayer-js";
import { loadLocalEnv, client, save, safeError } from "./live-common.mjs";
loadLocalEnv();
try {
  const network = process.env.GENLAYER_NETWORK || "studionet",
    filename = `${network}-deployment.json`,
    record = JSON.parse(readFileSync("deployments/" + filename, "utf8"));
  if (!record.transactionHash)
    throw Error(
      "Submission outcome is unknown. Inspect signer activity in Studio before any retry.",
    );
  const transaction = await client().waitForFinalization({
    hash: record.transactionHash,
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
    throw Error("The recorded deployment is not successfully finalized.");
  }
  record.contractAddress =
    transaction.txDataDecoded?.contractAddress || transaction.recipient;
  record.finalizedAt = new Date().toISOString();
  save(filename, record);
  console.log("Finalized deployment:", record.contractAddress);
} catch (error) {
  console.error(safeError(error));
  process.exitCode = 1;
}
