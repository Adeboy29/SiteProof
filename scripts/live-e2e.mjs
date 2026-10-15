import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { loadLocalEnv, save, safeError } from "./live-common.mjs";
loadLocalEnv();
const base = new URL(process.env.SITEPROOF_BASE_URL || "http://127.0.0.1:3000");
if (
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw Error("Use HTTPS for a hosted site.");
const origin = base.origin,
  record = {
    createdAt: new Date().toISOString(),
    siteOrigin: origin,
    status: "started",
    synthetic: true,
  };
const sessions = {};
async function session(email, password) {
  const cookies = new Map();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (items) =>
          items.forEach(({ name, value }) => cookies.set(name, value)),
      },
    },
  );
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return cookies;
}
async function request(path, { method = "GET", body, as = "owner" } = {}) {
  const cookies = sessions[as];
  const headers = {
    origin,
    Cookie: [...(cookies || [])].map(([k, v]) => k + "=" + v).join("; "),
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(path, origin), {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "error",
  });
  const result = await response.json();
  if (!response.ok) throw Error(`${path}: ${result.error || response.status}`);
  return result;
}
try {
  if (process.env.GENLAYER_MODE !== "genlayer")
    throw Error(
      "Live E2E requires GENLAYER_MODE=genlayer. It never substitutes development results.",
    );
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GENLAYER_CONTRACT_ADDRESS",
  ])
    if (!process.env[key])
      throw Error("Missing required live configuration: " + key);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  for (const role of ["owner", "inspector"]) {
    const email = `siteproof-${role}-${randomUUID()}@example.invalid`,
      password = randomBytes(30).toString("base64url") + "Aa1!";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Synthetic hackathon " + role },
    });
    if (error) throw error;
    record[role + "Id"] = data.user.id;
    sessions[role] = await session(email, password);
  }
  const readiness = await request("/api/integration");
  if (!readiness.liveVerified)
    throw Error(
      "The running site has not verified its database and contract interface. Rebuild/restart after configuration.",
    );
  const project = await request("/api/workspace", {
    method: "POST",
    body: {
      action: "project",
      name: "SYNTHETIC · Hackathon end-to-end verification",
      reference: "E2E-" + randomUUID(),
      address: "Synthetic test site, Lagos",
      description:
        "Generated test records only. Not a real construction claim.",
    },
  });
  record.projectId = project.id;
  await request("/api/workspace", {
    method: "POST",
    body: {
      action: "member",
      project_id: project.id,
      user_id: record.inspectorId,
      role: "inspector",
    },
  });
  const milestone = await request("/api/workspace", {
    method: "POST",
    body: {
      action: "milestone",
      project_id: project.id,
      title: "SYNTHETIC · Foundation test",
      criteria:
        "An attributed laboratory test and inspection establish concrete strength of at least 25 MPa.",
      due_date: "2026-12-31",
      value: 1000,
      payment_conditions: "Synthetic record only; no payment will be made.",
    },
  });
  record.milestoneId = milestone.id;
  const upload = new FormData();
  upload.set("milestone_id", milestone.id);
  upload.set("description", "Synthetic laboratory report: 22 MPa.");
  upload.set(
    "file",
    new Blob(
      [
        "SYNTHETIC report for hackathon E2E: concrete sample strength is 22 MPa.",
      ],
      { type: "text/plain" },
    ),
    "synthetic-laboratory-report.txt",
  );
  const evidence = await request("/api/evidence", {
    method: "POST",
    body: upload,
  });
  record.evidenceHash = evidence.hash;
  await request("/api/workspace", {
    method: "POST",
    as: "inspector",
    body: {
      action: "inspection",
      project_id: project.id,
      milestone_id: milestone.id,
      notes:
        "Synthetic attributed inspection: a separate sample reads 27 MPa, but the sample cannot be linked confidently to this milestone. The evidence conflicts.",
    },
  });
  await request("/api/workspace", {
    method: "POST",
    body: {
      action: "submit",
      project_id: project.id,
      milestone_id: milestone.id,
    },
  });
  const prep = await request("/api/preparation?milestone=" + milestone.id);
  await request("/api/preparation", {
    method: "POST",
    body: {
      submission_id: prep.submission_id,
      consent: true,
      evidence: prep.evidence.map((e) => ({
        id: e.id,
        description: "Synthetic public lab summary: 22 MPa.",
      })),
      inspections: prep.inspections.map((i) => ({
        id: i.id,
        notes:
          "Synthetic public inspection: 27 MPa on a sample that cannot be confidently linked to the milestone.",
      })),
    },
  });
  const assessment = await request("/api/workspace", {
    method: "POST",
    body: {
      action: "assess",
      project_id: project.id,
      milestone_id: milestone.id,
    },
  });
  if (
    assessment.mode !== "genlayer" ||
    !/^0x[0-9a-fA-F]{64}$/.test(assessment.transaction || "")
  )
    throw Error(
      "The application did not return a genuine GenLayer transaction identifier.",
    );
  record.assessmentId = assessment.id;
  record.transactionHash = assessment.transaction;
  record.status = "submitted";
  save("application-e2e.json", record);
  console.log("Submitted actual app assessment:", record.transactionHash);
  let finalized = false;
  for (let i = 0; i < 120; i++) {
    const tx = await request(
      "/api/transactions?assessment=" + record.assessmentId,
    );
    console.log("Protocol:", tx.status, "Execution:", tx.execution);
    if (tx.lifecycle?.state === "finalized") {
      if (!tx.successful) throw Error("GenLayer execution failed.");
      finalized = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!finalized)
    throw Error(
      "Still pending. Resume the recorded assessment in the application; do not submit another transaction.",
    );
  const workspace = await request("/api/workspace"),
    assessmentResult = workspace.assessments.find(
      (a) => a.id === record.assessmentId,
    );
  if (!assessmentResult?.report)
    throw Error("Finalized transaction has no application-validated report.");
  record.report = assessmentResult.report;
  record.status = "verified-finalized-app-workflow";
  record.verifiedAt = new Date().toISOString();
  save("application-e2e.json", record);
  console.log(
    "VERIFIED: auth → project → evidence → inspection → immutable submission → redacted manifest → GenLayer → validated report.",
  );
} catch (error) {
  record.status = record.transactionHash
    ? "pending-or-failed-reconcile-existing-transaction"
    : "incomplete";
  record.error = safeError(error);
  save("application-e2e.json", record);
  console.error(record.error);
  process.exitCode = 1;
}
