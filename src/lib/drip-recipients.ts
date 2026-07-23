import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@/lib/prisma";

const ROWS_PER_STATEMENT = 4_000;

/**
 * Bulk-insert drip recipients in as few Worker subrequests as possible.
 * Prisma createMany uses transactions (unsupported on Neon HTTP).
 * Looping $executeRaw per batch burns one Cloudflare subrequest each —
 * large lists (e.g. 14k @ 200/batch) exceed the free-plan limit of 50.
 *
 * Neon `sql.transaction([...])` sends every INSERT in ONE HTTP call.
 */
export async function insertDripRecipients(
  dripCampaignId: string,
  list: { email: string; name?: string | null }[]
): Promise<number> {
  if (list.length === 0) return 0;

  const sql = neon(getConnectionString());
  const queries = [];

  for (let i = 0; i < list.length; i += ROWS_PER_STATEMENT) {
    const slice = list.slice(i, i + ROWS_PER_STATEMENT);
    const ids = slice.map(() => crypto.randomUUID());
    const dripIds = slice.map(() => dripCampaignId);
    const emails = slice.map((r) => String(r.email).trim().toLowerCase());
    const names = slice.map((r) => (r.name ? String(r.name) : null));
    const positions = slice.map((_, idx) => i + idx);
    const statuses = slice.map(() => "pending");

    queries.push(sql`
      INSERT INTO "DripRecipient" ("id", "dripCampaignId", "email", "name", "position", "status", "createdAt")
      SELECT id, drip_id, email, name, position, status, NOW()
      FROM UNNEST(
        ${ids}::text[],
        ${dripIds}::text[],
        ${emails}::text[],
        ${names}::text[],
        ${positions}::int[],
        ${statuses}::text[]
      ) AS t(id, drip_id, email, name, position, status)
    `);
  }

  await sql.transaction(queries);
  return list.length;
}
