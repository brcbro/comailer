import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";

async function scopedSmtp(id: string, organizationId: string | null) {
  return prisma.smtpConfig.findFirst({
    where: { id, ...orgWhere(organizationId) },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const smtp = await scopedSmtp(id, organizationId);
    if (!smtp) {
      return NextResponse.json({ error: "SMTP config not found" }, { status: 404 });
    }

    const senders = await prisma.sender.findMany({
      where: { smtpConfigId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(senders);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to fetch senders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const body = await request.json();
    const { email, displayName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const smtpConfig = await scopedSmtp(id, organizationId);
    if (!smtpConfig) {
      return NextResponse.json({ error: "SMTP config not found" }, { status: 404 });
    }

    const sender = await prisma.sender.create({
      data: {
        smtpConfigId: id,
        email,
        displayName: displayName || null,
      },
    });

    return NextResponse.json(sender, { status: 201 });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to create sender";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
