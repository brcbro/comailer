/**
 * Single-admin auth helpers.
 *
 * Uses the Web Crypto API (HMAC-SHA256) so the same code runs in the Edge
 * middleware runtime and in Node route handlers. The session is a signed,
 * self-contained token: `base64url(payload).base64url(signature)`.
 */

export const SESSION_COOKIE = "mailer_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const sessionCookieOptions = {
  httpOnly: true,
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

async function getKey(): Promise<CryptoKey> {
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
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time string comparison to avoid leaking length/content via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/** Verify the submitted password against ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const rawExpected = process.env.ADMIN_PASSWORD || "changeme";
  const expected = rawExpected.trim().replace(/^["']|["']$/g, "");
  const cleanInput = (input || "").trim().replace(/^["']|["']$/g, "");

  if (!expected) return false;
  return timingSafeEqual(cleanInput, expected);
}

/** Create a signed, expiring session token. */
export async function createSessionToken(): Promise<string> {
  const payloadObj = { exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

/** Verify a session token's signature and expiry. */
export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expected: string;
  try {
    expected = await sign(payload);
  } catch {
    return false;
  }
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      exp?: number;
    };
    if (typeof data.exp !== "number" || Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}
