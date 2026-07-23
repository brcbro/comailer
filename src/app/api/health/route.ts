import { NextResponse } from "next/server";
import { prisma, getConnectionString } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.smtpConfig.count();
    return NextResponse.json({
      ok: true,
      database: "connected",
      appUrl: process.env.APP_URL || null,
      hasDatabaseUrl: Boolean(getConnectionString()),
      hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
      runtime: process.env.NEXT_RUNTIME || "unknown",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database check failed";
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: message,
        hasDatabaseUrl: Boolean(getConnectionString()),
        hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
        hint: "Set DATABASE_URL (Neon postgres URL) as a Wrangler secret and run prisma migrate deploy.",
      },
      { status: 500 }
    );
  }
}
