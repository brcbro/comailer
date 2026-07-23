import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  readRequestedOrgId,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request),
      requireOrg: false,
    });

    const configs = await prisma.smtpConfig.findMany({
      where: orgWhere(organizationId),
      include: {
        senders: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { campaigns: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const safeConfigs = configs.map((c) => ({
      ...c,
      hasPassword: !!c.passwordEnc,
      hasApiToken: !!c.apiTokenEnc,
      passwordEnc: undefined,
      apiTokenEnc: undefined,
    }));

    return NextResponse.json(safeConfigs);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to fetch SMTP configs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { name, mode, domain, bounceAddress, region, host, port, secure, username, password, apiToken } = body;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request, body),
      requireOrg: true,
    });

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
        organizationId: organizationId!,
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
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to create SMTP config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
