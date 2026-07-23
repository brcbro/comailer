/**
 * Multi-user auth helpers (ADMIN / CLIENT) — route-handler / server-component safe.
 * Session crypto lives in session.ts so Edge middleware stays Prisma-free.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ORG_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  hashPassword,
  orgCookieOptions,
  sessionCookieOptions,
  slugify,
  verifyPasswordHash,
  verifySessionToken,
  type SessionPayload,
  type UserRole,
} from "@/lib/session";

export {
  ORG_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  hashPassword,
  orgCookieOptions,
  sessionCookieOptions,
  slugify,
  verifyPasswordHash,
  verifySessionToken,
  type SessionPayload,
  type UserRole,
};

export { isAuthenticated } from "@/lib/session";

/**
 * Ensure at least one ADMIN user exists (bootstrap from ADMIN_EMAIL + ADMIN_PASSWORD).
 * Safe to call on every login attempt.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) return;

  const email = (process.env.ADMIN_EMAIL || "admin@localhost")
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, "");
  const password = (process.env.ADMIN_PASSWORD || "changeme")
    .trim()
    .replace(/^["']|["']$/g, "");

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      organizationId: null,
      isActive: true,
    },
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}

export async function requireAdmin(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const result = await requireSession();
  if ("error" in result) return result;
  if (result.session.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
