import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  try {
    const configs = await prisma.smtpConfig.findMany({
      include: {
        senders: true,
        _count: { select: { campaigns: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Mask sensitive fields
    const safeConfigs = configs.map((c) => ({
      ...c,
      hasPassword: !!c.passwordEnc,
      hasApiToken: !!c.apiTokenEnc,
      passwordEnc: undefined,
      apiTokenEnc: undefined,
    }));

    return NextResponse.json(safeConfigs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch SMTP configs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, mode, domain, bounceAddress, region, host, port, secure, username, password, apiToken } = body;

    if (!name || !domain) {
      return NextResponse.json({ error: "Name and domain are required" }, { status: 400 });
    }

    if ((mode || "SMTP") === "API" && !bounceAddress?.trim()) {
      return NextResponse.json(
        {
          error:
            "Bounce address is required for API mode. Copy it from ZeptoMail → Domains (e.g. bounce@bounce.yourdomain.com).",
        },
        { status: 400 }
      );
    }

    const config = await prisma.smtpConfig.create({
      data: {
        name,
        mode: mode || "SMTP",
        domain,
        bounceAddress: bounceAddress?.trim() || null,
        region: region || "com",
        host: host || (mode === "SMTP" ? "smtp.zeptomail.com" : null),
        port: port ? parseInt(port) : (mode === "SMTP" ? 587 : null),
        secure: secure ?? false,
        username: username || (mode === "SMTP" ? "emailapikey" : null),
        passwordEnc: password ? encrypt(password) : null,
        apiTokenEnc: apiToken ? encrypt(apiToken) : null,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create SMTP config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
