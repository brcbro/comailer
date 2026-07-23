import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";

async function findScopedTemplate(id: string, organizationId: string | null) {
  return prisma.template.findFirst({
    where: { id, ...orgWhere(organizationId) },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const template = await findScopedTemplate(id, organizationId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to fetch template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const existing = await findScopedTemplate(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, subject, type, body: templateBody } = body;

    const updated = await prisma.template.update({
      where: { id },
      data: {
        name,
        subject,
        type: type === "HTML" ? "HTML" : "TEXT",
        body: templateBody,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to update template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, { requireOrg: false });
    const { id } = await params;
    const existing = await findScopedTemplate(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.template.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to delete template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
