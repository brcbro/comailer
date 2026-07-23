import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ORG_COOKIE, SESSION_COOKIE } from "@/lib/cookies";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ORG_COOKIE);
  return NextResponse.json({ ok: true });
}
