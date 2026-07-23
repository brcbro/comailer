import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedMessage, isAccessExpired } from "@/lib/access";

/**
 * Load org and reject if inactive or past accessEndsAt.
 * Returns null if ok, or a NextResponse error.
 */
export async function assertOrgCanSend(
  organizationId: string,
): Promise<NextResponse | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, accessEndsAt: true, name: true },
  });
  if (!org || !org.isActive) {
    return NextResponse.json(
      { error: "This client account is disabled" },
      { status: 403 },
    );
  }
  if (isAccessExpired(org.accessEndsAt)) {
    return NextResponse.json(
      { error: accessDeniedMessage(org.accessEndsAt) },
      { status: 403 },
    );
  }
  return null;
}
