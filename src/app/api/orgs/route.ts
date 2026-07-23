import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ORG_COOKIE, orgCookieOptions, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** List organizations the current user can switch into (ADMIN: all active). */
export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (auth.session.role === "CLIENT") {
    if (!auth.session.organizationId) {
      return NextResponse.json([]);
    }
    const org = await prisma.organization.findUnique({
      where: { id: auth.session.organizationId },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return NextResponse.json(org ? [org] : []);
  }

  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  return NextResponse.json(orgs);
}

/** Set active org context cookie (ADMIN only). */
export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (auth.session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let organizationId: string | null = null;
  try {
    const body = (await request.json()) as { organizationId?: string | null };
    organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const cookieStore = await cookies();

  if (!organizationId) {
    cookieStore.delete(ORG_COOKIE);
    return NextResponse.json({ ok: true, organizationId: null });
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  cookieStore.set(ORG_COOKIE, organizationId, orgCookieOptions);
  return NextResponse.json({ ok: true, organizationId, name: org.name });
}
