import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  ensureBootstrapAdmin,
  sessionCookieOptions,
  verifyPasswordHash,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    email = (body?.email ?? "").trim().toLowerCase();
    password = body?.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  try {
    await ensureBootstrapAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { id: true, isActive: true, name: true } } },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.role === "CLIENT") {
    if (!user.organizationId || !user.organization?.isActive) {
      return NextResponse.json(
        { error: "This client account is disabled" },
        { status: 403 },
      );
    }
  }

  const ok = await verifyPasswordHash(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
    },
  });
}
