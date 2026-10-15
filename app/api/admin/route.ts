import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "../../../lib/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
async function context() {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: allowed } = await db.rpc("is_platform_admin");
  if (!user || !allowed || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    user,
    admin: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    ),
  };
}
export async function GET() {
  try {
    const c = await context();
    if (!c)
      return NextResponse.json(
        { error: "Administrator access required" },
        { status: 403 },
      );
    const [users, organizations, activity] = await Promise.all([
      c.admin.auth.admin.listUsers({ perPage: 100 }),
      c.admin.from("organizations").select("*").limit(100),
      c.admin
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (users.error || organizations.error || activity.error) throw Error();
    return NextResponse.json(
      {
        users: users.data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
        })),
        organizations: organizations.data,
        activity: activity.data,
        health: "Database reachable",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Admin service unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const c = await context();
    if (!c)
      return NextResponse.json(
        { error: "Administrator access required" },
        { status: 403 },
      );
    const body = z
      .object({ email: z.string().email(), action: z.literal("invite_user") })
      .safeParse(await req.json());
    if (!body.success)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { data, error } = await c.admin.auth.admin.inviteUserByEmail(
      body.data.email,
      { redirectTo: req.nextUrl.origin + "/auth/callback" },
    );
    if (error) throw error;
    await c.admin.from("activity_events").insert({
      actor_id: c.user.id,
      type: "admin_invitation",
      summary: "Administrator issued user invitation",
      record_id: data.user.id,
    });
    return NextResponse.json({ id: data.user.id });
  } catch {
    return NextResponse.json(
      { error: "Invitation could not be issued" },
      { status: 400 },
    );
  }
}
