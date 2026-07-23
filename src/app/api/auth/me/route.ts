import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ORG_COOKIE } from "@/lib/cookies";
import { prisma } from "@/lib/prisma";
import { daysRemaining, isAccessExpired } from "@/lib/access";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          accessEndsAt: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessOrg = user.organization;
  if (user.role === "ADMIN") {
    const cookieStore = await cookies();
    const selectedOrgId = cookieStore.get(ORG_COOKIE)?.value?.trim() || null;
    if (selectedOrgId) {
      accessOrg = await prisma.organization.findUnique({
        where: { id: selectedOrgId },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          accessEndsAt: true,
        },
      });
    } else {
      accessOrg = null;
    }
  }

  const endsAt = accessOrg?.accessEndsAt ?? null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organization: user.organization,
    },
    access: accessOrg
      ? {
          organizationId: accessOrg.id,
          organizationName: accessOrg.name,
          accessEndsAt: endsAt,
          daysRemaining: daysRemaining(endsAt),
          expired: isAccessExpired(endsAt),
        }
      : null,
  });
}
