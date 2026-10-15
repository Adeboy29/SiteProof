import { Data, developmentReport, Milestone } from "./domain";
export function demoData(): Data {
  const now = new Date().toISOString(),
    d: Data = {
      projects: [],
      milestones: [],
      evidence: [],
      assessments: [],
      disputes: [],
      activity: [],
      notifications: [],
    };
  const names = [
    ["Lekki Residence", "Lekki Phase 1, Lagos"],
    ["Victoria Commercial Hub", "Victoria Island, Lagos"],
    ["Oakwood Apartments", "Ikeja GRA, Lagos"],
  ];
  names.forEach(([name, address], i) => {
    const id = crypto.randomUUID();
    d.projects.push({
      id,
      name,
      address,
      reference: `SP-2026-00${i + 1}`,
      description:
        "Labelled demonstration project for exploring SiteProof. Records are not real construction claims.",
      status: "active",
      currency: "NGN",
      created_at: now,
    });
    [
      "Site preparation & foundation",
      "Reinforcement & formwork",
      "Concrete casting",
      "Blockwork & masonry",
    ].forEach((title, j) => {
      const m: Milestone = {
        id: crypto.randomUUID(),
        project_id: id,
        title,
        criteria: [
          "Attributed inspector report confirms dimensions against agreed drawings.",
          "Signed test results establish compliance with the specified material requirements.",
          "Work area photographed and outstanding defects documented.",
        ],
        version: 1,
        status: j === 0 ? "accepted" : j === 1 ? "submitted" : "draft",
        due_date: `2026-${j < 2 ? "10" : "11"}-${18 + j * 3}`,
        value: (j + 1) * 2400000,
        payment_conditions:
          "Owner approval after signed inspection; payment is handled separately.",
      };
      d.milestones.push(m);
      if (i === 0 && j === 0) {
        d.assessments.push({
          id: crypto.randomUUID(),
          project_id: id,
          milestone_id: m.id,
          report: developmentReport(m, []),
          mode: "development",
          created_at: now,
        });
      }
      if (i === 1 && j === 1) {
        m.status = "disputed";
        d.disputes.push({
          id: crypto.randomUUID(),
          project_id: id,
          milestone_id: m.id,
          reason:
            "Demonstration dispute: agreed reinforcement spacing needs an attributed inspection.",
          status: "open",
          created_at: now,
        });
      }
    });
    d.activity.push({
      id: crypto.randomUUID(),
      project_id: id,
      type: "demo_seed",
      summary: `Demo project created · ${name}`,
      created_at: now,
    });
  });
  return d;
}
