import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";
import { assertOrgCanSend } from "@/lib/assert-org-access";

async function findScopedDrip(id: string, organizationId: string | null) {
  return prisma.dripCampaign.findFirst({
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
    const campaign = await prisma.dripCampaign.findFirst({
      where: { id, ...orgWhere(organizationId) },
      include: {
        smtpConfig: { select: { id: true, name: true, domain: true } },
        sender: { select: { id: true, email: true, displayName: true } },
        template: { select: { id: true, name: true } },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [pending, sent, failed, total, recent] = await Promise.all([
      prisma.dripRecipient.count({ where: { dripCampaignId: id, status: "pending" } }),
      prisma.dripRecipient.count({ where: { dripCampaignId: id, status: "sent" } }),
      prisma.dripRecipient.count({ where: { dripCampaignId: id, status: "failed" } }),
      prisma.dripRecipient.count({ where: { dripCampaignId: id } }),
      prisma.dripRecipient.findMany({
        where: { dripCampaignId: id },
        orderBy: [{ status: "asc" }, { position: "asc" }],
        take: 50,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          error: true,
          sentAt: true,
          position: true,
        },
      }),
    ]);

    return NextResponse.json({
      ...campaign,
      stats: { total, pending, sent, failed },
      sampleRecipients: recent,
    });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to load campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const body = await request.json();
    const existing = await findScopedDrip(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.dailyLimit === "number" || typeof body.dailyLimit === "string") {
      data.dailyLimit = Math.max(1, parseInt(String(body.dailyLimit), 10) || 1);
    }
    if (typeof body.batchSize === "number" || typeof body.batchSize === "string") {
      data.batchSize = Math.max(1, Math.min(50, parseInt(String(body.batchSize), 10) || 1));
    }
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    // Mid-campaign content change — applies to all still-pending recipients.
    if (typeof body.subject === "string" && body.subject.trim()) {
      data.subject = body.subject.trim();
    }
    if (typeof body.body === "string" && body.body.trim()) {
      data.body = body.body;
    }
    if (body.bodyType === "HTML" || body.bodyType === "TEXT") {
      data.bodyType = body.bodyType;
    }
    if (body.templateId === null || body.templateId === "") {
      data.templateId = null;
    } else if (typeof body.templateId === "string") {
      const tpl = await prisma.template.findFirst({
        where: { id: body.templateId, organizationId: existing.organizationId },
      });
      if (!tpl) {
        return NextResponse.json({ error: "Template not found" }, { status: 400 });
      }
      data.templateId = tpl.id;
      // Applying a template fills subject/body unless the client already overrode them.
      if (data.subject === undefined) data.subject = tpl.subject;
      if (data.body === undefined) data.body = tpl.body;
      if (data.bodyType === undefined) {
        data.bodyType = tpl.type === "HTML" ? "HTML" : "TEXT";
      }
    }

    if (body.status === "running" || body.status === "paused") {
      if (body.status === "running") {
        const denied = await assertOrgCanSend(existing.organizationId);
        if (denied) return denied;
        const pending = await prisma.dripRecipient.count({
          where: { dripCampaignId: id, status: "pending" },
        });
        if (pending === 0) {
          return NextResponse.json(
            {
              error:
                existing.status === "completed"
                  ? "No pending recipients left — campaign is completed"
                  : "This campaign has no pending recipients. Delete it and create a new one with a recipient list.",
            },
            { status: 400 }
          );
        }
      }
      data.status = body.status;
    }

    if (body.action === "retryFailed") {
      // Avoid updateMany — Neon HTTP wraps it in an unsupported transaction.
      await prisma.$executeRaw`
        UPDATE "DripRecipient"
        SET status = ${"pending"}, error = NULL
        WHERE "dripCampaignId" = ${id} AND status = ${"failed"}
      `;
      if (existing.status === "completed") {
        data.status = "paused";
      }
    }

    const updated = await prisma.dripCampaign.update({
      where: { id },
      data,
    });

    // Keep linked analytics campaign content in sync for future opens/clicks views.
    if (
      existing.campaignId &&
      (data.subject !== undefined || data.body !== undefined || data.bodyType !== undefined)
    ) {
      await prisma.campaign.update({
        where: { id: existing.campaignId },
        data: {
          ...(data.subject !== undefined ? { subject: data.subject as string } : {}),
          ...(data.body !== undefined ? { body: data.body as string } : {}),
          ...(data.bodyType !== undefined ? { bodyType: data.bodyType as string } : {}),
          ...(data.templateId !== undefined
            ? { templateId: data.templateId as string | null }
            : {}),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const existing = await findScopedDrip(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.dripCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
