/**
 * Client access window helpers (organization.accessEndsAt).
 */

export function endOfAccessDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Parse YYYY-MM-DD (or ISO) into end-of-day UTC; null if empty. */
export function parseAccessEndsAt(input: unknown): Date | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string" && !(input instanceof Date)) return null;
  const raw = typeof input === "string" ? input.trim() : input.toISOString();
  if (!raw) return null;
  // date-only → treat as that calendar day (UTC end)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, day] = raw.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return endOfAccessDay(parsed);
}

export function isAccessExpired(accessEndsAt: Date | string | null | undefined): boolean {
  if (!accessEndsAt) return false;
  const end = typeof accessEndsAt === "string" ? new Date(accessEndsAt) : accessEndsAt;
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}

/** Whole days remaining including today if still valid; 0 if expired; null if no end date. */
export function daysRemaining(accessEndsAt: Date | string | null | undefined): number | null {
  if (!accessEndsAt) return null;
  const end = typeof accessEndsAt === "string" ? new Date(accessEndsAt) : accessEndsAt;
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  if (ms < 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function accessDeniedMessage(accessEndsAt: Date | string | null | undefined): string {
  if (!isAccessExpired(accessEndsAt)) return "";
  return "Access expired. Contact your administrator to renew sending access.";
}
