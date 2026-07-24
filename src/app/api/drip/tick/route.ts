import { NextRequest, NextResponse } from "next/server";
import { runDripTick } from "@/lib/drip-worker";
import { getSession } from "@/lib/auth";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  // Manual "Send now" from the dashboard (logged-in user).
  const session = await getSession();
  if (session) return true;
  // Local/dev without CRON_SECRET.
  if (!cronSecret) return true;
  return false;
}

/** Cloudflare cron (via worker scheduled) or manual trigger while logged in. */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDripTick();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
