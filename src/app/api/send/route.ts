import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { personalize, prepareTrackedBody } from "@/lib/tracking";
import { sendEmail } from "@/lib/mailer";
import { parseRecipientsText } from "@/lib/parse-recipients";

interface RecipientInput {
  email: string;
  name?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      campaignName,
      smtpConfigId,
      senderId,
      templateId,
      subject,
      bodyType,
      body: emailBody,
      recipients: recipientsInput,
    } = body;

    if (!campaignName || !smtpConfigId || !senderId || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Campaign name, SMTP config, Sender, subject, and body are required." },
        { status: 400 }
      );
    }

    // 1. Fetch SMTP Config & Sender
    const smtpConfig = await prisma.smtpConfig.findUnique({
      where: { id: smtpConfigId },
    });
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!smtpConfig || !sender) {
      return NextResponse.json(
        { error: "Invalid SMTP Config or Sender selected." },
        { status: 400 }
      );
    }

    // 2. Parse Recipients input
    let recipientList: RecipientInput[] = [];
    if (Array.isArray(recipientsInput)) {
      recipientList = recipientsInput.filter((r) => r && r.email && r.email.includes("@"));
    } else if (typeof recipientsInput === "string") {
      recipientList = parseRecipientsText(recipientsInput);
    }

    if (recipientList.length === 0) {
      return NextResponse.json(
        { error: "At least one valid recipient email is required." },
        { status: 400 }
      );
    }

    // 3. Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName,
        smtpConfigId,
        senderId,
        templateId: templateId || null,
        subject,
        bodyType: bodyType === "HTML" ? "HTML" : "TEXT",
        body: emailBody,
        status: "sending",
      },
    });

    let successCount = 0;
    let failureCount = 0;
    const sendResults: Array<{ email: string; success: boolean; error?: string }> = [];

    // 4. Send emails to recipients sequentially
    for (const rec of recipientList) {
      // Create recipient record
      const dbRecipient = await prisma.recipient.create({
        data: {
          campaignId: campaign.id,
          email: rec.email,
          name: rec.name || null,
          status: "pending",
        },
      });

      try {
        const personalizedSubject = personalize(subject, rec);
        const personalizedBody = personalize(emailBody, rec);
        const trackedBody = prepareTrackedBody(
          personalizedBody,
          bodyType === "HTML" ? "HTML" : "TEXT",
          dbRecipient.trackingId
        );

        await sendEmail({
          smtpConfig,
          fromEmail: sender.email,
          fromName: sender.displayName,
          toEmail: rec.email,
          toName: rec.name,
          subject: personalizedSubject,
          body: trackedBody,
          bodyType: bodyType === "HTML" ? "HTML" : "TEXT",
        });

        await prisma.recipient.update({
          where: { id: dbRecipient.id },
          data: { status: "sent", sentAt: new Date() },
        });

        successCount++;
        sendResults.push({ email: rec.email, success: true });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send email";
        await prisma.recipient.update({
          where: { id: dbRecipient.id },
          data: { status: "failed", error: errorMessage },
        });

        failureCount++;
        sendResults.push({ email: rec.email, success: false, error: errorMessage });
      }
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "completed" },
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalCount: recipientList.length,
      successCount,
      failureCount,
      results: sendResults,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Send campaign failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
