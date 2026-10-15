import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
const base = process.env.SITEPROOF_URL || "http://127.0.0.1:3101";
const journal = "deployments/simple-verification-pending.json";
mkdirSync("deployments", { recursive: true });
const payload = existsSync(journal)
  ? JSON.parse(readFileSync(journal, "utf8"))
  : {
      id: randomUUID(),
      title: "Synthetic hackathon test: Block A concrete",
      criteria: ["Concrete must reach 25 MPa at 28 days."],
      evidence:
        "SYNTHETIC TEST DATA. Lab report LAB-014: sample BA-F01, Block A foundation, strength 22 MPa at 28 days. The claimed milestone cannot be accepted at 25 MPa.",
      inspector: "Synthetic demo inspector",
      inspection:
        "SYNTHETIC NOTES. I checked LAB-014. BA-F01 is identified as Block A foundation. Its strength is 22 MPa at 28 days, below the required 25 MPa. An engineering review is necessary.",
      publicConsent: true,
    };
const health = await (await fetch(base + "/api/assess")).json();
if (!health.ready) throw Error(health.error);
if (!existsSync(journal)) {
  writeFileSync(journal, JSON.stringify(payload, null, 2));
  const response = await fetch(base + "/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(payload),
  });
  const job = await response.json();
  console.log("Submission", JSON.stringify(job));
  if (!response.ok) throw Error(job.error);
}
for (let i = 0; i < 70; i++) {
  const response = await fetch(base + "/api/assess?id=" + payload.id);
  const job = await response.json();
  console.log("Status", job.state, job.protocolStatus || "", job.hash || "");
  if (job.state === "finalized") {
    if (!job.report || job.report.milestone_id !== payload.id)
      throw Error("Invalid report identity");
    writeFileSync(
      "deployments/simple-verification.json",
      JSON.stringify(
        { ...job, verifiedAt: new Date().toISOString(), fixture: payload },
        null,
        2,
      ),
    );
    console.log("VERIFIED on-chain assessment:", job.report.outcome);
    process.exit(0);
  }
  if (job.state === "rejected") throw Error(job.error || job.state);
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
throw Error(
  "Still pending. Run the same command to resume; it will not resubmit.",
);
