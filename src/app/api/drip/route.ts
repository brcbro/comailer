import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecipientsText } from "@/lib/parse-recipients";

export async function GET() {
  try {
    const campaigns = await prisma.dripCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        smtpConfig: { select: { id: true, name: true, domain: true } },
        sender: { select: { id: true, email: true, displayName: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });

    const withStats = await Promise.all(
      campaigns.map(async (c) => {
        const [pending, sent, failed] = await Promise.all([
          prisma.dripRecipient.count({
            where: { dripCampaignId: c.id, status: "pending" },
          }),
          prisma.dripRecipient.count({
            where: { dripCampaignId: c.id, status: "sent" },
          }),
          prisma.dripRecipient.count({
            where: { dripCampaignId: c.id, status: "failed" },
          }),
        ]);
        return {
          ...c,
          stats: {
            total: c._count.recipients,
            pending,
            sent,
            failed,
          },
        };
      })
    );

    return NextResponse.json(withStats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list drip campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const smtp = await prisma.smtpConfig.findUnique({ where: { id: smtpConfigId } });
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!smtp || !sender || sender.smtpConfigId !== smtpConfigId) {
      return NextResponse.json({ error: "Invalid SMTP or sender" }, { status: 400 });
    }

    const campaign = await prisma.dripCampaign.create({
      data: {
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

    const BATCH = 500;
    for (let i = 0; i < list.length; i += BATCH) {
      const slice = list.slice(i, i + BATCH);
      await prisma.dripRecipient.createMany({
        data: slice.map((r: { email: string; name?: string }, idx: number) => ({
          dripCampaignId: campaign.id,
          email: String(r.email).trim().toLowerCase(),
          name: r.name || null,
          position: i + idx,
          status: "pending",
        })),
      });
    }

    const full = await prisma.dripCampaign.findUnique({
      where: { id: campaign.id },
      include: { _count: { select: { recipients: true } } },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create drip campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
