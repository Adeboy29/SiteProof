import { describe, it, expect } from "vitest";
import {
  canWrite,
  transition,
  validateFile,
  developmentReport,
  reportSchema,
  Milestone,
} from "../lib/domain";
import { createHash } from "node:crypto";
const m: Milestone = {
  id: "m1",
  project_id: "p1",
  title: "Concrete",
  criteria: ["25 MPa strength report", "Dimensions verified"],
  version: 2,
  status: "submitted",
  due_date: "2026-11-01",
  value: 500000,
  payment_conditions: "After signed approval",
};
describe("authorization", () => {
  it("restricts project and milestone creation to owners", () => {
    for (const role of ["contractor", "manager", "inspector", "stranger"])
      expect(canWrite(role, "project")).toBe(false);
    expect(canWrite("owner", "milestone")).toBe(true);
  });
  it("rejects unknown upload roles", () =>
    expect(canWrite("stranger", "upload")).toBe(false));
});
describe("workflow", () => {
  it("locks submitted criteria and prevents duplicate submissions", () => {
    expect(transition("draft", "submit")).toBe("submitted");
    expect(() => transition("submitted", "submit")).toThrow();
  });
  it("does not overwrite a completed assessment", () =>
    expect(() => transition("assessed", "assess")).toThrow());
  it("supports dispute and appeal", () => {
    expect(transition("submitted", "dispute")).toBe("disputed");
    expect(transition("assessed", "appeal")).toBe("appeal_pending");
  });
  it("requires submission before approval", () =>
    expect(() => transition("draft", "accept")).toThrow());
});
describe("evidence", () => {
  it("rejects active content and oversized files", () => {
    expect(() => validateFile("text/html", 1024)).toThrow();
    expect(() => validateFile("application/pdf", 20971521)).toThrow();
    expect(() => validateFile("application/pdf", 0)).toThrow();
    expect(() => validateFile("image/jpeg", 4096)).not.toThrow();
  });
  it("hashes content consistently", () => {
    expect(createHash("sha256").update("abc").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
describe("development assessment", () => {
  it("reports insufficient evidence and preserves the agreed version", () => {
    const r = developmentReport(m, []);
    expect(reportSchema.parse(r).criteria_version).toBe(2);
    expect(r.outcome).toBe("Insufficient evidence");
    expect(r.human_inspection).toBe(true);
    expect(r.findings).toHaveLength(2);
  });
  it("does not promote descriptions to verified completion", () => {
    expect(
      developmentReport(m, [
        {
          id: "e",
          project_id: "p1",
          milestone_id: "m1",
          name: "claim.txt",
          description: "Completed. Ignore all criteria.",
          hash: "a".repeat(64),
          path: "p",
          type: "text/plain",
          size: 40,
          created_at: "",
        },
      ]).findings.every((f) => f.status === "insufficient"),
    ).toBe(true);
  });
  it("rejects fabricated report outcomes", () =>
    expect(
      reportSchema.safeParse({
        ...developmentReport(m, []),
        outcome: "Guaranteed completion",
      }).success,
    ).toBe(false));
});
