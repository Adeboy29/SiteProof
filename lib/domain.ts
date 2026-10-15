import { z } from "zod";
export const outcomes = [
  "Requirements satisfied",
  "Requirements partially satisfied",
  "Requirements not satisfied",
  "Insufficient evidence",
  "Human inspection required",
] as const;
export const reportSchema = z.object({
  milestone_id: z.string(),
  criteria_version: z.number().int().positive(),
  outcome: z.enum(outcomes),
  findings: z.array(
    z.object({
      criterion: z.string(),
      status: z.enum(["satisfied", "not_satisfied", "insufficient"]),
      evidence: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
  missing: z.array(z.string()),
  uncertainty: z.string(),
  human_inspection: z.boolean(),
  summary: z.string(),
});
export type Report = z.infer<typeof reportSchema>;
export type Project = {
  id: string;
  name: string;
  reference: string;
  address: string;
  description: string;
  status: string;
  currency: string;
  created_at: string;
};
export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  criteria: string[];
  version: number;
  status: string;
  due_date: string;
  value: number;
  payment_conditions: string;
};
export type Evidence = {
  id: string;
  project_id: string;
  milestone_id: string;
  name: string;
  description: string;
  hash: string;
  path: string;
  type: string;
  size: number;
  created_at: string;
};
export type Data = {
  projects: Project[];
  milestones: Milestone[];
  evidence: Evidence[];
  inspections?: {
    id: string;
    milestone_id: string;
    actor_id: string;
    notes: string;
    created_at: string;
  }[];
  assessments: {
    id: string;
    project_id: string;
    milestone_id: string;
    report: Report;
    mode: string;
    created_at: string;
  }[];
  disputes: {
    id: string;
    project_id: string;
    milestone_id: string;
    reason: string;
    status: string;
    created_at: string;
  }[];
  activity: {
    id: string;
    project_id?: string;
    type: string;
    summary: string;
    created_at: string;
  }[];
  notifications: { id: string; message: string; read: boolean }[];
};
export const emptyData = (): Data => ({
  projects: [],
  milestones: [],
  evidence: [],
  assessments: [],
  disputes: [],
  activity: [],
  notifications: [],
});
export function developmentReport(m: Milestone, e: Evidence[]): Report {
  return {
    milestone_id: m.id,
    criteria_version: m.version,
    outcome: "Insufficient evidence",
    findings: m.criteria.map((criterion) => ({
      criterion,
      status: "insufficient",
      evidence: e.map((x) => x.id),
      explanation:
        "Development adapter cannot verify physical work. An attributed inspection is required.",
    })),
    missing: m.criteria,
    uncertainty: "Files and descriptions alone do not establish completion.",
    human_inspection: true,
    summary:
      "Development assessment only. No GenLayer transaction or consensus. Arrange an independent inspection.",
  };
}
export function canWrite(role: string, action: string) {
  return action === "project" || action === "milestone"
    ? role === "owner"
    : ["owner", "contractor", "inspector", "manager"].includes(role);
}
export function transition(status: string, action: string) {
  const allowed: Record<string, string[]> = {
    submit: ["draft", "additional_evidence"],
    accept: ["submitted"],
    dispute: ["submitted", "accepted"],
    request_evidence: ["submitted"],
    assess: ["submitted", "disputed"],
    appeal: ["assessed", "accepted", "submitted", "disputed"],
  };
  if (!allowed[action]?.includes(status))
    throw Error("Invalid workflow transition");
  return (
    {
      submit: "submitted",
      accept: "accepted",
      dispute: "disputed",
      request_evidence: "additional_evidence",
      assess: "assessed",
      appeal: "appeal_pending",
    } as Record<string, string>
  )[action];
}
export const fileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
];
export function validateFile(type: string, size: number) {
  if (!fileTypes.includes(type) || size < 1 || size > 4 * 1024 * 1024)
    throw Error("Use JPG, PNG, WebP, PDF, TXT or CSV, up to 4 MB.");
}
