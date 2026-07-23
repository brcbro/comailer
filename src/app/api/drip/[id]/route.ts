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

    if (body.status === "running" || body.status === "paused") {
      if (body.status === "running") {
        const denied = await assertOrgCanSend(existing.organizationId);
        if (denied) return denied;
      }
      if (existing.status === "completed" && body.status === "running") {
        const pending = await prisma.dripRecipient.count({
          where: { dripCampaignId: id, status: "pending" },
        });
        if (pending === 0) {
          return NextResponse.json(
            { error: "No pending recipients left — campaign is completed" },
            { status: 400 }
          );
        }
      }
      data.status = body.status;
    }

    if (body.action === "retryFailed") {
      const failed = await prisma.dripRecipient.findMany({
        where: { dripCampaignId: id, status: "failed" },
        select: { id: true },
      });
      for (const row of failed) {
        await prisma.dripRecipient.update({
          where: { id: row.id },
          data: { status: "pending", error: null },
        });
      }
      if (existing.status === "completed") {
        data.status = "paused";
      }
    }

    const updated = await prisma.dripCampaign.update({
      where: { id },
      data,
    });

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
