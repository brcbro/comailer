import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id, senderId } = await params;

    const smtp = await prisma.smtpConfig.findFirst({
      where: { id, ...orgWhere(organizationId) },
    });
    if (!smtp) {
      return NextResponse.json({ error: "SMTP config not found" }, { status: 404 });
    }

    const sender = await prisma.sender.findFirst({
      where: { id: senderId, smtpConfigId: id },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    await prisma.sender.delete({ where: { id: senderId } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to delete sender";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
