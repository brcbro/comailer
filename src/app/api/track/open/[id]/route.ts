import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/tracking";

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(TRANSPARENT_GIF.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

async function logOpen(request: Request, trackingId: string) {
  if (!trackingId) return;
  const recipient = await prisma.recipient.findUnique({
    where: { trackingId },
    select: { id: true },
  });
  if (!recipient) return;

  await prisma.trackingEvent.create({
    data: {
      recipientId: recipient.id,
      type: "OPEN",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await logOpen(request, id);
  } catch (err) {
    console.error("Tracking open error:", err);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}

/** Some mail clients / proxies probe images with HEAD */
export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await logOpen(request, id);
  } catch (err) {
    console.error("Tracking open HEAD error:", err);
  }

  return new NextResponse(null, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}
