import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ORG_COOKIE, type SessionPayload } from "@/lib/session";

export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve which organization the request may access.
 *
 * - CLIENT: always their own organizationId (required).
 * - ADMIN: prefers explicit `requestedOrgId`, then `mailer_org` cookie.
 *   When `requireOrg` is true and none is set, throws TenantError.
 *   When `requireOrg` is false and none is set, returns null (= all orgs for ADMIN).
 */
export async function resolveOrganizationId(
  session: SessionPayload,
  opts?: {
    requestedOrgId?: string | null;
    requireOrg?: boolean;
  },
): Promise<string | null> {
  const requireOrg = opts?.requireOrg ?? false;
  const requested = opts?.requestedOrgId?.trim() || null;

  if (session.role === "CLIENT") {
    if (!session.organizationId) {
      throw new TenantError("Client account has no organization", 403);
    }
    if (requested && requested !== session.organizationId) {
      throw new TenantError("Forbidden", 403);
    }
    return session.organizationId;
  }

  // ADMIN
  if (requested) return requested;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ORG_COOKIE)?.value?.trim() || null;
  if (fromCookie) return fromCookie;

  if (requireOrg) {
    throw new TenantError(
      "Select a client organization before creating or editing resources",
      400,
    );
  }
  return null;
}

/** Prisma where clause fragment for organization scoping. */
export function orgWhere(organizationId: string | null): { organizationId?: string } {
  if (!organizationId) return {};
  return { organizationId };
}

export function tenantErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof TenantError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/** Read organizationId from request URL query or JSON body field. */
export function readRequestedOrgId(
  request: Request,
  body?: Record<string, unknown> | null,
): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("organizationId");
  if (fromQuery?.trim()) return fromQuery.trim();
  const fromBody = body?.organizationId;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  const header = request.headers.get("x-organization-id");
  if (header?.trim()) return header.trim();
  return null;
}
