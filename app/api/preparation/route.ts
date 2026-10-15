import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "../../../lib/server";
import { z } from "zod";
export async function GET(req: NextRequest) {
  try {
    const db = await serverDb();
    const mid = req.nextUrl.searchParams.get("milestone");
    const { data: s } = await db
      .from("milestone_submissions")
      .select("*")
      .eq("milestone_id", mid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!s)
      return NextResponse.json(
        { error: "Submit the milestone first." },
        { status: 400 },
      );
    const { data: prepared } = await db
      .from("prepared_manifests")
      .select("*")
      .eq("submission_id", s.id)
      .maybeSingle();
    const { data: inspections } = await db
      .from("inspections")
      .select("id")
      .eq("milestone_id", mid);
    return NextResponse.json(
      {
        submission_id: s.id,
        criteria: s.criteria_snapshot,
        criteria_version: s.criteria_version,
        prepared: prepared?.manifest || null,
        evidence: s.evidence_manifest.map(
          (e: { id: string; hash: string }) => ({
            id: e.id,
            hash: e.hash,
            description: "",
          }),
        ),
        inspections: (inspections || []).map((i) => ({ id: i.id, notes: "" })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Preparation unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const body = z
      .object({
        submission_id: z.string().uuid(),
        consent: z.literal(true),
        evidence: z
          .array(
            z.object({
              id: z.string().uuid(),
              description: z.string().min(1).max(5000),
            }),
          )
          .max(100),
        inspections: z
          .array(
            z.object({
              id: z.string().uuid(),
              notes: z.string().min(1).max(5000),
            }),
          )
          .max(100),
      })
      .parse(await req.json());
    const db = await serverDb();
    const { data, error } = await db.rpc("approve_manifest", {
      sid: body.submission_id,
      evidence_summaries: body.evidence,
      inspection_summaries: body.inspections,
    });
    if (error) throw error;
    return NextResponse.json({ id: data });
  } catch {
    return NextResponse.json(
      {
        error:
          "Approval rejected. Check permissions, summary references and previous approval.",
      },
      { status: 400 },
    );
  }
}
