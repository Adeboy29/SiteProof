import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "../../../lib/server";
import { validateFile } from "../../../lib/domain";
import { validateBytes } from "../../../lib/file-validation";
import { createHash, randomUUID } from "node:crypto";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: allowed } = await db.rpc("consume_limit", {
      bucket_name: "upload",
      max_requests: 20,
    });
    if (!allowed)
      return NextResponse.json(
        { error: "Upload rate limit reached. Try again in a minute." },
        { status: 429 },
      );
    const f = await req.formData(),
      file = f.get("file");
    if (!(file instanceof File)) throw Error("File required");
    validateFile(file.type, file.size);
    const mid = String(f.get("milestone_id"));
    const { data: m } = await db
      .from("milestones")
      .select("project_id,status")
      .eq("id", mid)
      .single();
    if (!m || !["draft", "additional_evidence"].includes(m.status))
      return NextResponse.json(
        { error: "Evidence is locked or access denied." },
        { status: 403 },
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    validateBytes(file.type, bytes);
    const hash = createHash("sha256").update(bytes).digest("hex"),
      path = `${m.project_id}/${user.id}/${randomUUID()}`;
    const { error: uploadError } = await db.storage
      .from("evidence")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw Error("Server registration credentials missing");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.rpc("register_evidence", {
      payload: {
        actor_id: user.id,
        milestone_id: mid,
        name: file.name.slice(0, 200),
        description: String(f.get("description") || "").slice(0, 5000),
        hash,
        path,
        type: file.type,
        size: file.size,
      },
    });
    if (error) throw error;
    return NextResponse.json({ id: data, hash });
  } catch {
    return NextResponse.json(
      {
        error:
          "Upload rejected. Check file type, size and project permissions.",
      },
      { status: 400 },
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: e } = await db
      .from("evidence_files")
      .select("path")
      .eq("id", req.nextUrl.searchParams.get("id"))
      .single();
    if (!e)
      return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    const { data, error } = await db.storage
      .from("evidence")
      .createSignedUrl(e.path, 60, { download: true });
    if (error) throw error;
    return NextResponse.json(
      { url: data.signedUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
