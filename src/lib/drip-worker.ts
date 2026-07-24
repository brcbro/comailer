import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { personalize, prepareTrackedBody } from "@/lib/tracking";
import { isAccessExpired } from "@/lib/access";

const TICK_MS = 60_000; // every minute
const SEND_DELAY_MS = 400; // spacing within a batch
/** Cap per tick to stay under Cloudflare free-plan subrequest limits (~50). */
const MAX_SENDS_PER_TICK = 5;

let started = false;
let ticking = false;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAnalyticsCampaign(drip: {
  id: string;
  organizationId: string;
  name: string;
  smtpConfigId: string;
  senderId: string;
  templateId: string | null;
  subject: string;
  bodyType: string;
  body: string;
  campaignId: string | null;
}): Promise<string> {
  if (drip.campaignId) return drip.campaignId;

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: drip.organizationId,
      name: `[Drip] ${drip.name}`,
      smtpConfigId: drip.smtpConfigId,
      senderId: drip.senderId,
      templateId: drip.templateId,
      subject: drip.subject,
      bodyType: drip.bodyType,
      body: drip.body,
      status: "sending",
    },
  });

  await prisma.dripCampaign.update({
    where: { id: drip.id },
    data: { campaignId: campaign.id },
  });

  return campaign.id;
}

async function processOneDrip(dripId: string) {
  const drip = await prisma.dripCampaign.findUnique({
    where: { id: dripId },
    include: {
      smtpConfig: true,
      sender: true,
    },
  });

  if (!drip || drip.status !== "running") return;

  const org = await prisma.organization.findUnique({
    where: { id: drip.organizationId },
    select: { isActive: true, accessEndsAt: true },
  });
  if (!org?.isActive || isAccessExpired(org.accessEndsAt)) {
    await prisma.dripCampaign.update({
      where: { id: drip.id },
      data: { status: "paused" },
    });
    return;
  }

  const key = todayKey();
  let sentToday = drip.sentToday;
  if (drip.dayKey !== key) {
    sentToday = 0;
    await prisma.dripCampaign.update({
      where: { id: drip.id },
      data: { sentToday: 0, dayKey: key },
    });
  }

  const remainingToday = Math.max(0, drip.dailyLimit - sentToday);
  if (remainingToday === 0) return;

  const take = Math.min(drip.batchSize, remainingToday, MAX_SENDS_PER_TICK);
  const queue = await prisma.dripRecipient.findMany({
    where: { dripCampaignId: drip.id, status: "pending" },
    orderBy: { position: "asc" },
    take,
  });

  if (queue.length === 0) {
    const [pendingLeft, total] = await Promise.all([
      prisma.dripRecipient.count({
        where: { dripCampaignId: drip.id, status: "pending" },
      }),
      prisma.dripRecipient.count({ where: { dripCampaignId: drip.id } }),
    ]);

    // Empty import / failed create — pause instead of falsely "completing".
    if (total === 0) {
      await prisma.dripCampaign.update({
        where: { id: drip.id },
        data: { status: "paused" },
      });
      return;
    }

    // Still have pending (race) — leave running.
    if (pendingLeft > 0) return;

    await prisma.dripCampaign.update({
      where: { id: drip.id },
      data: { status: "completed" },
    });
    if (drip.campaignId) {
      await prisma.campaign.update({
        where: { id: drip.campaignId },
        data: { status: "completed" },
      });
    }
    return;
  }

  const analyticsCampaignId = await ensureAnalyticsCampaign(drip);
  let sentThisTick = 0;

  for (const item of queue) {
    // Re-check pause / daily cap mid-batch
    const fresh = await prisma.dripCampaign.findUnique({
      where: { id: drip.id },
      select: { status: true, sentToday: true, dailyLimit: true, dayKey: true },
    });
    if (!fresh || fresh.status !== "running") break;

    let currentSent = fresh.sentToday;
    if (fresh.dayKey !== key) {
      // Day flipped mid-batch — reset counter in DB (don't only fix the local var).
      await prisma.dripCampaign.update({
        where: { id: drip.id },
        data: { sentToday: 0, dayKey: key },
      });
      currentSent = 0;
    }
    if (currentSent >= fresh.dailyLimit) break;

    try {
      const trackedRecipient = await prisma.recipient.create({
        data: {
          campaignId: analyticsCampaignId,
          email: item.email,
          name: item.name,
          status: "pending",
        },
      });

      const rec = { email: item.email, name: item.name };
      const personalizedSubject = personalize(drip.subject, rec);
      const personalizedBody = personalize(drip.body, rec);
      const trackedBody = prepareTrackedBody(
        personalizedBody,
        drip.bodyType === "HTML" ? "HTML" : "TEXT",
        trackedRecipient.trackingId
      );

      await sendEmail({
        smtpConfig: drip.smtpConfig,
        fromEmail: drip.sender.email,
        fromName: drip.sender.displayName,
        toEmail: item.email,
        toName: item.name,
        subject: personalizedSubject,
        body: trackedBody,
        bodyType: drip.bodyType === "HTML" ? "HTML" : "TEXT",
      });

      await prisma.recipient.update({
        where: { id: trackedRecipient.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await prisma.dripRecipient.update({
        where: { id: item.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          recipientId: trackedRecipient.id,
          error: null,
        },
      });
      // Atomic day-aware increment (avoids carrying yesterday's sentToday into today).
      await prisma.$executeRaw`
        UPDATE "DripCampaign"
        SET
          "sentToday" = CASE WHEN "dayKey" = ${key} THEN "sentToday" + 1 ELSE 1 END,
          "dayKey" = ${key}
        WHERE id = ${drip.id}
      `;

      sentThisTick++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      await prisma.dripRecipient.update({
        where: { id: item.id },
        data: { status: "failed", error: message },
      });
      // Stop the batch on infra limits so the next cron minute can continue cleanly.
      if (/too many subrequests/i.test(message) || /Worker invocation/i.test(message)) {
        break;
      }
    }

    await sleep(SEND_DELAY_MS);
  }

  return sentThisTick;
}

export async function runDripTick(): Promise<{
  processed: number;
  campaigns: number;
}> {
  if (ticking) return { processed: 0, campaigns: 0 };
  ticking = true;
  try {
    const running = await prisma.dripCampaign.findMany({
      where: { status: "running" },
      select: { id: true },
    });

    let processed = 0;
    for (const c of running) {
      const n = await processOneDrip(c.id);
      processed += n || 0;
    }
    return { processed, campaigns: running.length };
  } finally {
    ticking = false;
  }
}

export function startDripWorker() {
  if (started) return;
  started = true;
  console.log("[drip] worker started (tick every 60s)");
  // Kick once shortly after boot, then on interval
  setTimeout(() => {
    runDripTick().catch((e) => console.error("[drip] tick error", e));
  }, 5_000);
  setInterval(() => {
    runDripTick().catch((e) => console.error("[drip] tick error", e));
  }, TICK_MS);
}
