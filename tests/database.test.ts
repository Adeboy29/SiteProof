import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
let pid: string, mid: string;
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  contractor = "00000000-0000-4000-8000-000000000003";
async function actor(id: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claim.role','authenticated',false);`,
  );
}
async function action(action: string, payload: Record<string, unknown>) {
  const r = await db.query<{ id: string }>(
    "select public.workspace_action($1,$2::jsonb) as id",
    [action, JSON.stringify(payload)],
  );
  return r.rows[0].id;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated;create role service_role;create schema auth;create schema storage;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;grant usage on schema public,auth,storage to authenticated,service_role;grant execute on all functions in schema auth to authenticated,service_role;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/001_siteproof.sql", "utf8").replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/002_amendments_and_limits.sql", "utf8"),
  );
  for (const migration of [
    "003_admin.sql",
    "004_prepared_manifests.sql",
    "005_transaction_audit.sql",
    "006_safe_preflight_retries.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  await db.exec(
    `insert into auth.users(id) values('${owner}'),('${other}'),('${contractor}');grant select,insert,update,delete on all tables in schema public,storage to authenticated;grant execute on all functions in schema public to authenticated;`,
  );
  await actor(owner);
  pid = await action("project", {
    name: "Foundation test",
    reference: "P001",
    address: "Lagos",
  });
  mid = await action("milestone", {
    project_id: pid,
    title: "Foundation",
    criteria: "25 MPa verified\nDimensions checked",
    due_date: "2026-11-01",
    value: 400000,
    payment_conditions: "Signed approval",
  });
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("actual PostgreSQL policies and workflows", () => {
  it("creates projects and versions criteria", async () => {
    const p = await db.query("select * from projects");
    expect(p.rows).toHaveLength(1);
    const c = await db.query("select version from milestone_criteria");
    expect(c.rows).toEqual([{ version: 1 }]);
  });
  it("prevents another organization from reading projects or private evidence", async () => {
    await db.exec("reset role");
    await db.exec(
      `insert into evidence_files(project_id,milestone_id,actor_id,name,description,hash,path,type,size) values('${pid}','${mid}','${owner}','report.pdf','Inspection','${"a".repeat(64)}','${pid}/${owner}/report','application/pdf',400)`,
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('evidence','${pid}/${owner}/report')`,
    );
    await actor(owner);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await actor(other);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from projects")).rows).toHaveLength(0);
    expect((await db.query("select * from evidence_files")).rows).toHaveLength(
      0,
    );
    await expect(
      action("submit", { project_id: pid, milestone_id: mid }),
    ).rejects.toThrow("Access denied");
    await actor(owner);
  });
  it("does not allow a contractor to elevate roles", async () => {
    await action("member", {
      project_id: pid,
      user_id: contractor,
      role: "contractor",
    });
    await actor(contractor);
    await expect(
      action("member", { project_id: pid, user_id: other, role: "manager" }),
    ).rejects.toThrow("Owner required");
    await actor(owner);
  });
  it("snapshots criteria and evidence and rejects duplicate submissions", async () => {
    await action("submit", { project_id: pid, milestone_id: mid });
    const s = await db.query<{
      criteria_version: number;
      evidence_manifest: unknown[];
    }>("select * from milestone_submissions");
    expect(s.rows[0].criteria_version).toBe(1);
    expect(s.rows[0].evidence_manifest).toHaveLength(1);
    await expect(
      action("submit", { project_id: pid, milestone_id: mid }),
    ).rejects.toThrow("Invalid submission");
  });
  it("rejects evidence registration after submission", async () => {
    await expect(
      db.query("select register_evidence($1::jsonb)", [
        JSON.stringify({ milestone_id: mid, path: `${pid}/${owner}/new` }),
      ]),
    ).rejects.toThrow("Backend required");
  });
  it("prevents silent edits to criteria, assessments and audit events", async () => {
    await db.query("update milestones set criteria=$1::jsonb where id=$2", [
      JSON.stringify(["Secretly altered"]),
      mid,
    ]);
    expect(
      (
        await db.query<{ criteria: string[] }>(
          "select criteria from milestones where id=$1",
          [mid],
        )
      ).rows[0].criteria[0],
    ).toBe("25 MPa verified");
    const before = (await db.query("select * from activity_events")).rows
      .length;
    await db.exec("delete from activity_events");
    expect((await db.query("select * from activity_events")).rows.length).toBe(
      before,
    );
  });
  it("records disputes and prevents duplicate assessment requests", async () => {
    await action("dispute", {
      project_id: pid,
      milestone_id: mid,
      reason: "Strength report conflicts with site measurements.",
    });
    expect((await db.query("select * from disputes")).rows).toHaveLength(1);
    await action("assessment_request", {
      project_id: pid,
      milestone_id: mid,
      mode: "development",
    });
    await expect(
      action("assessment_request", {
        project_id: pid,
        milestone_id: mid,
        mode: "development",
      }),
    ).rejects.toThrow();
  });
  it("rejects client-written assessment outcomes", async () => {
    const a = await db.query<{ id: string }>("select id from assessments");
    await expect(
      db.query("select finish_assessment($1,$2,$3)", [
        a.rows[0].id,
        "{}",
        "finalized",
      ]),
    ).rejects.toThrow("Backend required");
  });
  it("requires both owner and contractor consent for an amendment", async () => {
    const r = await db.query<{ id: string }>(
      "select amend_criteria($1,$2::jsonb) as id",
      [
        "propose",
        JSON.stringify({
          milestone_id: mid,
          criteria: "Revised strength test",
          reason: "Both parties agree to a revised test standard.",
        }),
      ],
    );
    expect(
      (await db.query<{ version: number }>("select version from milestones"))
        .rows[0].version,
    ).toBe(1);
    await actor(contractor);
    await db.query("select amend_criteria($1,$2::jsonb)", [
      "agree",
      JSON.stringify({ amendment_id: r.rows[0].id }),
    ]);
    expect(
      (await db.query<{ version: number }>("select version from milestones"))
        .rows[0].version,
    ).toBe(2);
    expect(
      (
        await db.query<{ criteria_snapshot: string[] }>(
          "select criteria_snapshot from milestone_submissions",
        )
      ).rows[0].criteria_snapshot[0],
    ).toBe("25 MPa verified");
    await actor(owner);
  });
  it("enforces persistent per-user request limits", async () => {
    await db.exec(
      "reset role;delete from request_limits where bucket='assessment'",
    );
    await actor(owner);
    for (let i = 0; i < 5; i++) {
      const r = await db.query<{ allowed: boolean }>(
        "select consume_limit($1,$2) as allowed",
        ["assessment", 999999],
      );
      expect(r.rows[0].allowed).toBe(true);
    }
    const r = await db.query<{ allowed: boolean }>(
      "select consume_limit($1,$2) as allowed",
      ["assessment", 999999],
    );
    expect(r.rows[0].allowed).toBe(false);
  });
  it("allows reviewed manifests only for authorized parties and binds original hashes", async () => {
    const submission = await db.query<{ id: string }>(
      "select id from milestone_submissions",
    );
    const ev = await db.query<{ id: string; hash: string }>(
      "select id,hash from evidence_files",
    );
    await actor(other);
    await expect(
      db.query("select approve_manifest($1,$2::jsonb,$3::jsonb)", [
        submission.rows[0].id,
        "[]",
        "[]",
      ]),
    ).rejects.toThrow("Owner or manager required");
    await actor(owner);
    const args = [
      submission.rows[0].id,
      JSON.stringify([
        {
          id: ev.rows[0].id,
          description: "Redacted inspection summary, no personal information.",
        },
      ]),
      "[]",
    ];
    await db.query("select approve_manifest($1,$2::jsonb,$3::jsonb)", args);
    const prepared = await db.query<{
      manifest: { evidence: { hash: string }[] };
    }>("select manifest from prepared_manifests");
    expect(prepared.rows[0].manifest.evidence[0].hash).toBe(ev.rows[0].hash);
    await expect(
      db.query("select approve_manifest($1,$2::jsonb,$3::jsonb)", args),
    ).rejects.toThrow();
  });
  it("does not allow an ordinary user to become platform administrator", async () => {
    await expect(
      db.exec(`insert into platform_admins(user_id) values ('${owner}')`),
    ).rejects.toThrow("row-level security");
    const r = await db.query<{ allowed: boolean }>(
      "select is_platform_admin() as allowed",
    );
    expect(r.rows[0].allowed).toBe(false);
  });
  it("retries proven preflight failures once and refuses uncertain broadcasts or finalized overwrites", async () => {
    await actor(contractor);
    await action("submit", { project_id: pid, milestone_id: mid });
    const aid = await action("assessment_request", {
      project_id: pid,
      milestone_id: mid,
      mode: "genlayer",
    });
    await db.exec(
      "select set_config('request.jwt.claim.role','service_role',false)",
    );
    await db.query("select finish_assessment($1,$2,$3)", [
      aid,
      null,
      "preflight_failed",
    ]);
    await db.exec(
      "select set_config('request.jwt.claim.role','authenticated',false)",
    );
    expect(
      (
        await db.query<{ id: string }>(
          "select retry_failed_assessment($1) as id",
          [aid],
        )
      ).rows[0].id,
    ).toBe(aid);
    await expect(
      db.query("select retry_failed_assessment($1)", [aid]),
    ).rejects.toThrow("Retry not permitted");
    await db.exec(
      "select set_config('request.jwt.claim.role','service_role',false)",
    );
    await db.query("select finish_assessment($1,$2,$3)", [
      aid,
      null,
      "submission_unknown",
    ]);
    await db.exec(
      "select set_config('request.jwt.claim.role','authenticated',false)",
    );
    await expect(
      db.query("select retry_failed_assessment($1)", [aid]),
    ).rejects.toThrow("Retry not permitted");
    await db.exec(
      "select set_config('request.jwt.claim.role','service_role',false)",
    );
    await db.query("select finish_assessment($1,$2,$3)", [
      aid,
      "{}",
      "finalized",
    ]);
    await expect(
      db.query("select finish_assessment($1,$2,$3)", [aid, "{}", "finalized"]),
    ).rejects.toThrow("Assessment is immutable");
    await actor(owner);
  });
});
