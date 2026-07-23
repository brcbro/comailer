import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { parseAccessEndsAt } from "@/lib/access";

const orgInclude = {
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
  _count: {
    select: {
      smtpConfigs: true,
      templates: true,
      campaigns: true,
      dripCampaigns: true,
    },
  },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: orgInclude,
  });

  if (!org) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      isActive?: boolean;
      accessEndsAt?: Date | null;
    } = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }
    if ("accessEndsAt" in body) {
      if (body.accessEndsAt === null || body.accessEndsAt === "") {
        data.accessEndsAt = null;
      } else {
        const parsed = parseAccessEndsAt(body.accessEndsAt);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid access end date" },
            { status: 400 },
          );
        }
        data.accessEndsAt = parsed;
      }
    }

    // Neon HTTP: no transactions — never use update+include (Prisma wraps that).
    if (Object.keys(data).length > 0) {
      await prisma.organization.update({
        where: { id },
        data,
      });
    }

    // Reset password for a user in this org
    if (body.resetUserId && body.newPassword) {
      const user = await prisma.user.findFirst({
        where: { id: String(body.resetUserId), organizationId: id },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (String(body.newPassword).length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(String(body.newPassword)) },
      });
    }

    // Toggle user active (avoid updateMany — also transactional on Neon HTTP)
    if (body.toggleUserId && typeof body.userIsActive === "boolean") {
      const user = await prisma.user.findFirst({
        where: { id: String(body.toggleUserId), organizationId: id },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: body.userIsActive },
      });
    }

    // Add another client user
    if (body.addUserEmail && body.addUserPassword) {
      const email = String(body.addUserEmail).trim().toLowerCase();
      const password = String(body.addUserPassword);
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 },
        );
      }
      await prisma.user.create({
        data: {
          email,
          name: body.addUserName ? String(body.addUserName).trim() : null,
          passwordHash: await hashPassword(password),
          role: "CLIENT",
          organizationId: id,
          isActive: true,
        },
      });
    }

    const refreshed = await prisma.organization.findUnique({
      where: { id },
      include: orgInclude,
    });

    return NextResponse.json(refreshed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (id === "org_internal_default") {
    return NextResponse.json(
      { error: "Cannot delete the Internal organization" },
      { status: 400 },
    );
  }

  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await prisma.organization.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
