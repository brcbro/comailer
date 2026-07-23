import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  requireAdmin,
  slugify,
} from "@/lib/auth";
import { parseAccessEndsAt } from "@/lib/access";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          smtpConfigs: true,
          templates: true,
          campaigns: true,
          dripCampaigns: true,
        },
      },
    },
  });

  return NextResponse.json(orgs);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const orgName = String(body.orgName || body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const userName = body.userName ? String(body.userName).trim() : null;
    const accessEndsAt = parseAccessEndsAt(body.accessEndsAt);

    if (!orgName || !email || !password) {
      return NextResponse.json(
        { error: "Organization name, email, and password are required" },
        { status: 400 },
      );
    }

    if (!accessEndsAt) {
      return NextResponse.json(
        { error: "Access end date is required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    let slug = slugify(orgName);
    const slugTaken = await prisma.organization.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const passwordHash = await hashPassword(password);

    // Neon HTTP adapter does not support transactions / nested writes.
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        isActive: true,
        accessEndsAt,
      },
    });

    await prisma.user.create({
      data: {
        email,
        name: userName || orgName,
        passwordHash,
        role: "CLIENT",
        organizationId: org.id,
        isActive: true,
      },
    });

    const full = await prisma.organization.findUnique({
      where: { id: org.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
