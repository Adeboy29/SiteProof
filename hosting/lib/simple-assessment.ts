import { z } from "zod";
import { createHash } from "node:crypto";
import { reportSchema } from "./domain";

export const assessmentInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    criteria: z.array(z.string().trim().min(3).max(1000)).min(1).max(12),
    evidence: z.string().trim().min(10).max(12000),
    inspector: z.string().trim().max(120).default(""),
    inspection: z.string().trim().max(8000).default(""),
    publicConsent: z.literal(true),
  })
  .refine((v) => !v.inspection || !!v.inspector, {
    message: "Name the inspector who supplied these notes.",
  });
export type AssessmentInput = z.infer<typeof assessmentInput>;
export function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function makeManifest(input: AssessmentInput) {
  return {
    milestone_id: input.id,
    title: input.title,
    criteria_version: 1,
    criteria: input.criteria,
    evidence: [
      {
        id: "evidence-1",
        name: "Submitted evidence text",
        description: input.evidence,
        hash: contentHash(input.evidence),
        provenance: "User supplied; authenticity not verified by SiteProof",
      },
    ],
    inspections: input.inspection
      ? [
          {
            id: "inspection-1",
            inspector: input.inspector,
            notes: input.inspection,
            provenance:
              "User attributed; inspector identity not verified by SiteProof",
          },
        ]
      : [],
  };
}
export type SimpleManifest = ReturnType<typeof makeManifest>;
export function verifySimpleReport(
  raw: unknown,
  manifest: SimpleManifest,
  anchoredHash: unknown,
) {
  if (anchoredHash !== contentHash(JSON.stringify(manifest)))
    throw Error("The on-chain evidence hash does not match this submission.");
  const report = reportSchema.parse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
  const ids = new Set(
    [...manifest.evidence, ...manifest.inspections].map((e) => e.id),
  );
  if (
    report.milestone_id !== manifest.milestone_id ||
    report.criteria_version !== manifest.criteria_version ||
    report.findings.length !== manifest.criteria.length ||
    report.findings.some(
      (f, i) =>
        f.criterion !== manifest.criteria[i] ||
        f.evidence.some((id) => !ids.has(id)),
    )
  )
    throw Error(
      "The contract report does not match this milestone and evidence.",
    );
  return report;
}
