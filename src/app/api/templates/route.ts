import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  orgWhere,
  readRequestedOrgId,
  resolveOrganizationId,
  tenantErrorResponse,
} from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request),
      requireOrg: false,
    });

    const templates = await prisma.template.findMany({
      where: orgWhere(organizationId),
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to fetch templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { name, subject, type, body: templateBody } = body;

    const organizationId = await resolveOrganizationId(auth.session, {
      requestedOrgId: readRequestedOrgId(request, body),
      requireOrg: true,
    });

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Name, subject, and body are required" },
        { status: 400 }
      );
    }

    const template = await prisma.template.create({
      data: {
        organizationId: organizationId!,
        name,
        subject,
        type: type === "HTML" ? "HTML" : "TEXT",
        body: templateBody,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err: unknown) {
    const te = tenantErrorResponse(err);
    if (te) return te;
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
