import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isSuccessful } from "genlayer-js";
import { reportSchema } from "../lib/domain.ts";
import {
  loadLocalEnv,
  client,
  contractAddress,
  quote,
  hash,
  save,
  sourceHash,
  safeError,
} from "./live-common.mjs";
loadLocalEnv();
try {
  const network = process.env.GENLAYER_NETWORK || "studionet",
    filename = `${network}-verification.json`,
    address = contractAddress(),
    sdk = client(true);
  const resume = process.argv.includes("--resume");
  if (
    existsSync("deployments/" + filename) &&
    !resume &&
    !process.argv.includes("--new")
  )
    throw Error(
      "An assessment journal already exists. Use --resume, or --new only for an intentional fresh assessment.",
    );
  let record, manifest;
  if (resume) {
    record = JSON.parse(readFileSync("deployments/" + filename, "utf8"));
    if (record.network !== network || record.contractAddress !== address)
      throw Error("Recorded network/address differ from active configuration.");
    manifest = record.manifest;
    if (!record.transactionHash)
      throw Error(
        "Submission outcome unknown. Reconcile it before another write.",
      );
  } else {
    const owner = await sdk.readContract({
      address,
      functionName: "get_owner",
      args: [],
    });
    if (String(owner).toLowerCase() !== sdk.account.address.toLowerCase())
      throw Error(
        "Configured signer is not the contract owner. Deploy with this signer or securely configure the original deployer.",
      );
    manifest = JSON.parse(
      readFileSync("fixtures/hackathon-manifest.json", "utf8"),
    );
    const serialized = JSON.stringify(manifest),
      requestId = "hackathon-" + randomUUID();
    record = {
      network,
      contractAddress: address,
      requestId,
      manifest,
      manifestHash: hash(serialized),
      sourceHash: sourceHash(),
      status: "submission_started",
      createdAt: new Date().toISOString(),
    };
    const estimate = await quote(sdk, "assess");
    save(filename, record);
    record.transactionHash = await sdk.writeContract({
      address,
      functionName: "assess",
      args: [requestId, serialized],
      fees: {
        distribution: estimate.distribution,
        feeValue: estimate.feeValue,
      },
    });
    record.status = "submitted";
    save(filename, record);
    console.log("Actual assessment transaction:", record.transactionHash);
  }
  const tx = await sdk.waitForFinalization({
    hash: record.transactionHash,
    interval: 5000,
    retries: 120,
  });
  record.status = tx.statusName;
  record.execution = tx.txExecutionResultName;
  record.lifecycle = tx.lifecycle;
  save(filename, record);
  if (tx.lifecycle.state !== "finalized" || !isSuccessful(tx))
    throw Error(
      "Assessment is not successfully finalized. No verification claim was generated.",
    );
  const raw = await sdk.readContract({
    address,
    functionName: "get_assessment",
    args: [record.requestId],
  });
  const report = reportSchema.parse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
  const anchored = await sdk.readContract({
    address,
    functionName: "get_manifest_hash",
    args: [record.requestId],
  });
  if (
    anchored !== record.manifestHash ||
    report.milestone_id !== manifest.milestone_id ||
    report.criteria_version !== manifest.criteria_version ||
    report.findings.length !== manifest.criteria.length ||
    report.findings.some(
      (f, i) =>
        f.criterion !== manifest.criteria[i] ||
        f.evidence.some(
          (id) =>
            ![...manifest.evidence, ...manifest.inspections].some(
              (e) => e.id === id,
            ),
        ),
    )
  )
    throw Error("Report or anchored manifest failed application validation.");
  record.report = report;
  record.anchoredManifestHash = anchored;
  record.verifiedAt = new Date().toISOString();
  record.verification = "finalized-successful-schema-and-manifest-verified";
  save(filename, record);
  console.log(
    "VERIFIED real GenLayer assessment:",
    report.outcome,
    "\nPublic evidence saved to deployments/" + filename,
  );
} catch (error) {
  console.error(safeError(error));
  process.exitCode = 1;
}
