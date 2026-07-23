export interface RecipientRow {
  email: string;
  name?: string;
}

const EMAIL_HEADER_KEYS = new Set([
  "email",
  "e-mail",
  "mail",
  "email address",
  "emailaddress",
  "email_address",
  "recipient",
  "to",
]);

const NAME_HEADER_KEYS = new Set([
  "name",
  "full name",
  "fullname",
  "full_name",
  "first name",
  "firstname",
  "first_name",
  "display name",
  "displayname",
]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function addRecipient(
  seen: Set<string>,
  out: RecipientRow[],
  emailRaw: unknown,
  nameRaw?: unknown
) {
  const email = String(emailRaw ?? "")
    .trim()
    .toLowerCase();
  if (!isValidEmail(email)) return;
  if (seen.has(email)) return;
  seen.add(email);
  const name = String(nameRaw ?? "").trim() || undefined;
  out.push({ email, name });
}

/** Parse pasted text: one recipient per line — `email` or `email, name` (comma/tab/semicolon). */
export function parseRecipientsText(raw: string): RecipientRow[] {
  const seen = new Set<string>();
  const out: RecipientRow[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
    if (parts.length === 0) continue;

    const first = parts[0]?.toLowerCase() ?? "";
    if (EMAIL_HEADER_KEYS.has(first) || first === "email") continue;

    const email = parts[0]?.toLowerCase();
    const name = parts[1] || undefined;
    if (email) addRecipient(seen, out, email, name);
  }

  return out;
}

export function recipientsToText(rows: RecipientRow[]): string {
  return rows
    .map((r) => (r.name ? `${r.email}, ${r.name}` : r.email))
    .join("\n");
}

export function countRecipientsInText(raw: string): number {
  return parseRecipientsText(raw).length;
}

export function findColumnKeys(row: Record<string, unknown>): {
  emailKey: string | null;
  nameKey: string | null;
} {
  const keys = Object.keys(row);
  let emailKey: string | null = null;
  let nameKey: string | null = null;

  for (const key of keys) {
    const norm = normalizeHeader(key);
    if (!emailKey && EMAIL_HEADER_KEYS.has(norm)) emailKey = key;
    if (!nameKey && NAME_HEADER_KEYS.has(norm)) nameKey = key;
  }

  if (!emailKey) {
    for (const key of keys) {
      const val = String(row[key] ?? "");
      if (isValidEmail(val)) {
        emailKey = key;
        break;
      }
    }
  }

  if (!nameKey && emailKey) {
    for (const key of keys) {
      if (key === emailKey) continue;
      const val = String(row[key] ?? "").trim();
      if (val && !isValidEmail(val)) {
        nameKey = key;
        break;
      }
    }
  }

  return { emailKey, nameKey };
}

export function parseSheetRows(rows: Record<string, unknown>[]): RecipientRow[] {
  const seen = new Set<string>();
  const out: RecipientRow[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { emailKey, nameKey } = findColumnKeys(row);

    if (emailKey) {
      addRecipient(seen, out, row[emailKey], nameKey ? row[nameKey] : undefined);
      continue;
    }

    const values = Object.values(row).map((v) => String(v ?? "").trim()).filter(Boolean);
    if (values.length === 0) continue;
    const emailIdx = values.findIndex((v) => isValidEmail(v));
    if (emailIdx >= 0) {
      addRecipient(
        seen,
        out,
        values[emailIdx],
        values[emailIdx + 1] && !isValidEmail(values[emailIdx + 1])
          ? values[emailIdx + 1]
          : undefined
      );
    }
  }

  return out;
}
