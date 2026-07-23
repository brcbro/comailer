import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { insertDripRecipients } from "@/lib/drip-recipients";
import { parseRecipientsText } from "@/lib/parse-recipients";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  readRequestedOrgId,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";
import { assertOrgCanSend } from "@/lib/assert-org-access";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request),
      requireOrg: false,
    });

    const campaigns = await prisma.dripCampaign.findMany({
      where: orgWhere(organizationId),
      orderBy: { createdAt: "desc" },
      include: {
        smtpConfig: { select: { id: true, name: true, domain: true } },
        sender: { select: { id: true, email: true, displayName: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });

    // One grouped query instead of 3 counts × N campaigns (saves Worker subrequests).
    const ids = campaigns.map((c) => c.id);
    const statusRows =
      ids.length === 0
        ? []
        : await prisma.dripRecipient.groupBy({
            by: ["dripCampaignId", "status"],
            where: { dripCampaignId: { in: ids } },
            _count: { _all: true },
          });

    const byCampaign = new Map<string, { pending: number; sent: number; failed: number }>();
    for (const row of statusRows) {
      const cur = byCampaign.get(row.dripCampaignId) || {
        pending: 0,
        sent: 0,
        failed: 0,
      };
      if (row.status === "pending") cur.pending = row._count._all;
      else if (row.status === "sent") cur.sent = row._count._all;
      else if (row.status === "failed") cur.failed = row._count._all;
      byCampaign.set(row.dripCampaignId, cur);
    }

    const withStats = campaigns.map((c) => {
      const s = byCampaign.get(c.id) || { pending: 0, sent: 0, failed: 0 };
      return {
        ...c,
        stats: {
          total: c._count.recipients,
          pending: s.pending,
          sent: s.sent,
          failed: s.failed,
        },
      };
    });

    return NextResponse.json(withStats);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to list drip campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      name,
      smtpConfigId,
      senderId,
      templateId,
      subject,
      bodyType,
      body: emailBody,
      dailyLimit,
      batchSize,
      recipients,
    } = body;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request, body),
      requireOrg: true,
    });

    const denied = await assertOrgCanSend(organizationId!);
    if (denied) return denied;

    if (!name || !smtpConfigId || !senderId || !subject || !emailBody) {
      return NextResponse.json(
        { error: "name, smtpConfigId, senderId, subject, and body are required" },
        { status: 400 }
      );
    }

    const list =
      typeof recipients === "string"
        ? parseRecipientsText(recipients)
        : Array.isArray(recipients)
          ? recipients.filter((r: { email?: string }) => r?.email?.includes("@"))
          : [];

    if (list.length === 0) {
      return NextResponse.json(
        { error: "Paste or upload at least one recipient email" },
        { status: 400 }
      );
    }

    const smtp = await prisma.smtpConfig.findFirst({
      where: { id: smtpConfigId, ...orgWhere(organizationId) },
    });
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!smtp || !sender || sender.smtpConfigId !== smtpConfigId) {
      return NextResponse.json({ error: "Invalid SMTP or sender" }, { status: 400 });
    }

    const campaign = await prisma.dripCampaign.create({
      data: {
        organizationId: organizationId!,
        name,
        smtpConfigId,
        senderId,
        templateId: templateId || null,
        subject,
        bodyType: bodyType === "HTML" ? "HTML" : "TEXT",
        body: emailBody,
        status: "paused",
        dailyLimit: Math.max(1, parseInt(String(dailyLimit || 100), 10) || 100),
        batchSize: Math.max(1, Math.min(50, parseInt(String(batchSize || 5), 10) || 5)),
        dayKey: "",
      },
    });

    try {
      const imported = await insertDripRecipients(campaign.id, list);
      if (imported === 0) {
        throw new Error("Recipient import saved 0 rows");
      }
    } catch (insertErr) {
      // Avoid orphan campaigns with an empty queue (worker would mark them completed).
      await prisma.dripCampaign.delete({ where: { id: campaign.id } }).catch(() => {});
      throw insertErr;
    }

    const full = await prisma.dripCampaign.findUnique({
      where: { id: campaign.id },
      include: { _count: { select: { recipients: true } } },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to create drip campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
