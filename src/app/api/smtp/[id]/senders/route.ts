import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const senders = await prisma.sender.findMany({
      where: { smtpConfigId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(senders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch senders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, displayName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const smtpConfig = await prisma.smtpConfig.findUnique({ where: { id } });
    if (!smtpConfig) {
      return NextResponse.json({ error: "SMTP config not found" }, { status: 404 });
    }

    // Optional domain match validation warning/check
    const sender = await prisma.sender.create({
      data: {
        smtpConfigId: id,
        email,
        displayName: displayName || null,
      },
    });

    return NextResponse.json(sender, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create sender";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
