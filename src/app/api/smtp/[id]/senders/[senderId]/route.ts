import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  try {
    const { id, senderId } = await params;

    const sender = await prisma.sender.findFirst({
      where: { id: senderId, smtpConfigId: id },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Past campaigns keep history; senderId is SetNull on delete.
    await prisma.sender.delete({ where: { id: senderId } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete sender";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
