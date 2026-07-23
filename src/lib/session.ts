/**
 * Session cookie crypto — Edge-safe (no Prisma / Node APIs).
 * Used by middleware and shared with auth helpers.
 */

import { ORG_COOKIE, SESSION_COOKIE } from "@/lib/cookies";

export { ORG_COOKIE, SESSION_COOKIE };

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type UserRole = "ADMIN" | "CLIENT";

export type SessionPayload = {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  email: string;
  name: string | null;
  exp: number;
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" ||
    (process.env.APP_URL || "").startsWith("https://"),
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export const orgCookieOptions = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" ||
    (process.env.APP_URL || "").startsWith("https://"),
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret =
    (process.env.SESSION_SECRET || "").trim().replace(/^["']|["']$/g, "") ||
    "session_secret_zeptomail_mailer_32bytes_key_super_secure";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(data: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(
  user: {
    id: string;
    role: string;
    organizationId: string | null;
    email: string;
    name: string | null;
  },
): Promise<string> {
  const payloadObj: SessionPayload = {
    userId: user.id,
    role: user.role === "ADMIN" ? "ADMIN" : "CLIENT",
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token?: string | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = await sign(payload);
  } catch {
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as SessionPayload;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    if (!data.userId || (data.role !== "ADMIN" && data.role !== "CLIENT")) return null;
    return data;
  } catch {
    return null;
  }
}

export async function isAuthenticated(token?: string | null): Promise<boolean> {
  return (await verifySessionToken(token)) !== null;
}

const PBKDF2_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPasswordHash(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expectedHex = parts[3];
  if (!iterations || salt.length === 0 || !expectedHex) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return timingSafeEqual(bytesToHex(new Uint8Array(bits)), expectedHex.toLowerCase());
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "client"
  );
}
