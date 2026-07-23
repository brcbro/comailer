import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, sanitizeRedirectUrl } from "@/lib/tracking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const targetUrl = sanitizeRedirectUrl(searchParams.get("u"));

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing or invalid redirect URL" },
      { status: 400 }
    );
  }

  try {
    const { id: trackingId } = await params;

    if (trackingId) {
      const recipient = await prisma.recipient.findUnique({
        where: { trackingId },
        select: { id: true },
      });

      if (recipient) {
        await prisma.trackingEvent.create({
          data: {
            recipientId: recipient.id,
            type: "CLICK",
            url: targetUrl,
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent") || undefined,
          },
        });
      }
    }
  } catch (err) {
    console.error("Tracking click error:", err);
  }

  return NextResponse.redirect(targetUrl, 302);
}
