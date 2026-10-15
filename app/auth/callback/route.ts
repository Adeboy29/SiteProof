import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "../../../lib/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const db = await serverDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          req.nextUrl.searchParams.get("recovery") === "1"
            ? "/auth/password"
            : "/",
          req.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", req.url));
}
