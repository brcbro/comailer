import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ smtpId: string }> }
) {
  try {
    const { smtpId } = await params;

    const smtpConfig = await prisma.smtpConfig.findUnique({
      where: { id: smtpId },
    });

    if (!smtpConfig) {
      return NextResponse.json({ error: "SMTP config not found" }, { status: 404 });
    }

    // Fetch campaigns for this SMTP config
    const campaigns = await prisma.campaign.findMany({
      where: { smtpConfigId: smtpId },
      include: {
        recipients: {
          include: {
            events: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalRecipients = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalOpens = 0;
    let totalClicks = 0;

    const uniqueOpenRecipientIds = new Set<string>();
    const uniqueClickRecipientIds = new Set<string>();

    const campaignStats = campaigns.map((camp) => {
      const campTotal = camp.recipients.length;
      const campSent = camp.recipients.filter((r) => r.status === "sent").length;
      const campFailed = camp.recipients.filter((r) => r.status === "failed").length;

      let campOpens = 0;
      let campClicks = 0;
      const campUniqueOpenIds = new Set<string>();
      const campUniqueClickIds = new Set<string>();

      camp.recipients.forEach((rec) => {
        rec.events.forEach((evt) => {
          if (evt.type === "OPEN") {
            campOpens++;
            totalOpens++;
            uniqueOpenRecipientIds.add(rec.id);
            campUniqueOpenIds.add(rec.id);
          } else if (evt.type === "CLICK") {
            campClicks++;
            totalClicks++;
            uniqueClickRecipientIds.add(rec.id);
            campUniqueClickIds.add(rec.id);
          }
        });
      });

      totalRecipients += campTotal;
      totalSent += campSent;
      totalFailed += campFailed;

      const openRate = campSent > 0 ? ((campUniqueOpenIds.size / campSent) * 100).toFixed(1) : "0.0";
      const clickRate = campSent > 0 ? ((campUniqueClickIds.size / campSent) * 100).toFixed(1) : "0.0";

      return {
        id: camp.id,
        name: camp.name,
        subject: camp.subject,
        createdAt: camp.createdAt,
        totalRecipients: campTotal,
        sent: campSent,
        failed: campFailed,
        opens: campOpens,
        clicks: campClicks,
        uniqueOpens: campUniqueOpenIds.size,
        uniqueClicks: campUniqueClickIds.size,
        openRate,
        clickRate,
      };
    });

    const uniqueOpensCount = uniqueOpenRecipientIds.size;
    const uniqueClicksCount = uniqueClickRecipientIds.size;

    const openRateOverall = totalSent > 0 ? ((uniqueOpensCount / totalSent) * 100).toFixed(1) : "0.0";
    const clickRateOverall = totalSent > 0 ? ((uniqueClicksCount / totalSent) * 100).toFixed(1) : "0.0";

    // Recent 20 events
    const recentEvents = await prisma.trackingEvent.findMany({
      where: {
        recipient: {
          campaign: {
            smtpConfigId: smtpId,
          },
        },
      },
      include: {
        recipient: {
          select: {
            email: true,
            name: true,
            campaign: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Chart daily activity (last 7 days) — use all events in the window, not just recent 20
    const chartDataMap: Record<string, { date: string; opens: number; clicks: number }> = {};
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      chartDataMap[dateStr] = { date: dateStr, opens: 0, clicks: 0 };
    }

    const weekEvents = await prisma.trackingEvent.findMany({
      where: {
        createdAt: { gte: weekAgo },
        recipient: {
          campaign: { smtpConfigId: smtpId },
        },
      },
      select: { type: true, createdAt: true },
    });

    weekEvents.forEach((evt) => {
      const evtDate = new Date(evt.createdAt).toISOString().split("T")[0];
      if (chartDataMap[evtDate]) {
        if (evt.type === "OPEN") chartDataMap[evtDate].opens++;
        if (evt.type === "CLICK") chartDataMap[evtDate].clicks++;
      }
    });

    const chartData = Object.values(chartDataMap);

    return NextResponse.json({
      smtpConfig: {
        id: smtpConfig.id,
        name: smtpConfig.name,
        domain: smtpConfig.domain,
        mode: smtpConfig.mode,
      },
      totals: {
        recipients: totalRecipients,
        sent: totalSent,
        failed: totalFailed,
        opens: totalOpens,
        uniqueOpens: uniqueOpensCount,
        openRate: openRateOverall,
        clicks: totalClicks,
        uniqueClicks: uniqueClicksCount,
        clickRate: clickRateOverall,
      },
      campaigns: campaignStats,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        email: e.recipient.email,
        campaignName: e.recipient.campaign.name,
        url: e.url,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
      chartData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
