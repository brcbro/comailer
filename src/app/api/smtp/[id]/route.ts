import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await prisma.smtpConfig.findUnique({
      where: { id },
      include: { senders: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...config,
      hasPassword: !!config.passwordEnc,
      hasApiToken: !!config.apiTokenEnc,
      passwordEnc: undefined,
      apiTokenEnc: undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, mode, domain, bounceAddress, region, host, port, secure, username, password, apiToken } = body;

    const data: Record<string, unknown> = {
      name,
      mode,
      domain,
      region,
      host,
      port: port ? parseInt(port) : null,
      secure: secure ?? false,
      username,
    };

    if (bounceAddress !== undefined) {
      data.bounceAddress = typeof bounceAddress === "string" ? bounceAddress.trim() || null : null;
    }

    if (password) {
      data.passwordEnc = encrypt(password);
    }
    if (apiToken) {
      data.apiTokenEnc = encrypt(apiToken);
    }

    const updated = await prisma.smtpConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.smtpConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
