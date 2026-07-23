import { NextResponse } from "next/server";
import { runDripTick } from "@/lib/drip-worker";

/** Manual / external-cron tick — also runs automatically via instrumentation worker. */
export async function POST() {
  try {
    const result = await runDripTick();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
