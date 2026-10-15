import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "../../../lib/server";
import { genlayerClient } from "../../../lib/genlayer";
import { isSuccessful } from "genlayer-js";
import type { Hash } from "genlayer-js/types";
import { createClient } from "@supabase/supabase-js";
import { reportSchema } from "../../../lib/domain";
import { classifyTransaction } from "../../../lib/transaction-state";
export async function GET(req: NextRequest) {
  try {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const milestone = req.nextUrl.searchParams.get("milestone");
    if (milestone) {
      const { data, error } = await db
        .from("assessments")
        .select("id,mode,status,criteria_version")
        .eq("milestone_id", milestone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json(
        { assessments: data },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const id = req.nextUrl.searchParams.get("assessment");
    const { data: a } = await db
      .from("assessments")
      .select("*")
      .eq("id", id)
      .single();
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: t } = await db
      .from("genlayer_transactions")
      .select("*")
      .eq("assessment_id", a.id)
      .single();
    if (!t) return NextResponse.json({ status: a.status, mode: a.mode });
    const { data: allowed, error: limitError } = await db.rpc("consume_limit", {
      bucket_name: "status",
      max_requests: 60,
    });
    if (limitError || !allowed)
      return NextResponse.json(
        {
          error:
            "Status checks are limited to 60 per minute. Your transaction has not been resubmitted.",
        },
        { status: 429 },
      );
    const client = genlayerClient(t.network),
      tx = await client.getTransaction({ hash: t.hash as Hash });
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { error: statusError } = await admin.rpc(
      "record_transaction_status",
      {
        tid: t.id,
        protocol_status: tx.statusName || "unknown",
        execution: tx.txExecutionResultName || null,
      },
    );
    if (statusError) throw statusError;
    const phase = classifyTransaction(tx.lifecycle.state, isSuccessful(tx));
    if (
      phase === "pending" &&
      ["submitted", "submission_unknown"].includes(a.status)
    ) {
      const { error } = await admin
        .from("assessments")
        .update({ status: "pending" })
        .eq("id", a.id)
        .in("status", ["submitted", "submission_unknown"]);
      if (error) throw error;
    }
    if (
      phase === "rejected" &&
      ["submitted", "pending", "submission_unknown"].includes(a.status)
    ) {
      const { error } = await admin.rpc("finish_assessment", {
        aid: a.id,
        result: null,
        new_status: "rejected",
      });
      if (error) throw error;
    }
    if (
      tx.lifecycle.state === "finalized" &&
      ["submitted", "pending", "submission_unknown"].includes(a.status)
    ) {
      if (isSuccessful(tx)) {
        const raw = await client.readContract({
          address: t.contract_address as `0x${string}`,
          functionName: "get_assessment",
          args: [a.id],
        });
        const anchoredHash = await client.readContract({
          address: t.contract_address as `0x${string}`,
          functionName: "get_manifest_hash",
          args: [a.id],
        });
        if (anchoredHash !== a.manifest_hash)
          throw Error("Manifest hash mismatch");
        const { data: submission } = await db
          .from("milestone_submissions")
          .select("criteria_snapshot,evidence_manifest")
          .eq("id", a.submission_id)
          .single();
        const { data: prepared } = await db
          .from("prepared_manifests")
          .select("manifest")
          .eq("submission_id", a.submission_id)
          .single();
        if (!prepared) throw Error("Approved manifest unavailable");
        const allowedReferences = new Set<string>(
          [...prepared.manifest.evidence, ...prepared.manifest.inspections].map(
            (e: { id: string }) => e.id,
          ),
        );
        const parsed = reportSchema.safeParse(
          typeof raw === "string" ? JSON.parse(raw) : raw,
        );
        if (
          !parsed.success ||
          parsed.data.milestone_id !== a.milestone_id ||
          parsed.data.criteria_version !== a.criteria_version
        )
          throw Error("Invalid contract result");
        if (
          !submission ||
          parsed.data.findings.length !== submission.criteria_snapshot.length ||
          parsed.data.findings.some(
            (f, i) =>
              f.criterion !== submission.criteria_snapshot[i] ||
              f.evidence.some((id) => !allowedReferences.has(id)),
          )
        )
          throw Error("Report does not match original submission");
        const { error } = await admin.rpc("finish_assessment", {
          aid: a.id,
          result: parsed.data,
          new_status: "finalized",
        });
        if (error) throw error;
      } else {
        await admin.rpc("finish_assessment", {
          aid: a.id,
          result: null,
          new_status: "rejected",
        });
      }
    }
    return NextResponse.json(
      {
        hash: t.hash,
        network: t.network,
        contract: t.contract_address,
        status: tx.statusName,
        execution: tx.txExecutionResultName,
        lifecycle: tx.lifecycle,
        successful: isSuccessful(tx),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Status unavailable. The transaction remains unresolved; do not resubmit.",
      },
      { status: 503 },
    );
  }
}
