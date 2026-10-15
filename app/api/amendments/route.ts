import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "../../../lib/server";
import { z } from "zod";
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("propose"),
    milestone_id: z.string().uuid(),
    criteria: z.string().min(1).max(15000),
    reason: z.string().min(10).max(5000),
  }),
  z.object({ operation: z.literal("agree"), amendment_id: z.string().uuid() }),
]);
export async function GET(req: NextRequest) {
  const db = await serverDb();
  const { data, error } = await db
    .from("criteria_amendments")
    .select("*")
    .eq("milestone_id", req.nextUrl.searchParams.get("milestone"));
  return error
    ? NextResponse.json({ error: "Unavailable" }, { status: 400 })
    : NextResponse.json(data);
}
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body = schema.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: "Invalid amendment" }, { status: 400 });
  const db = await serverDb();
  const { operation, ...payload } = body.data;
  const { data, error } = await db.rpc("amend_criteria", {
    operation,
    payload,
  });
  return error
    ? NextResponse.json(
        { error: "Amendment not permitted or already recorded." },
        { status: 400 },
      )
    : NextResponse.json({ id: data });
}
