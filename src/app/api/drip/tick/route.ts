import { NextRequest, NextResponse } from "next/server";
import { runDripTick } from "@/lib/drip-worker";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

/** Cloudflare cron (via worker scheduled) or manual trigger with Bearer CRON_SECRET. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
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
