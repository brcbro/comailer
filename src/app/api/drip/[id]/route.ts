import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await prisma.dripCampaign.findUnique({
      where: { id },
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
    const message = err instanceof Error ? err.message : "Failed to load campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.dripCampaign.findUnique({ where: { id } });
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
      await prisma.dripRecipient.updateMany({
        where: { dripCampaignId: id, status: "failed" },
        data: { status: "pending", error: null },
      });
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
    const message = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dripCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
