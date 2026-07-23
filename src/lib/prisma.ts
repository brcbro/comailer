import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

export function getConnectionString(): string {
  return (process.env.DATABASE_URL || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function createPrismaClient() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon PostgreSQL URL as a Wrangler secret (wrangler secret put DATABASE_URL)."
    );
  }

  if (
    !connectionString.startsWith("postgres://") &&
    !connectionString.startsWith("postgresql://")
  ) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string (postgresql://...) for production."
    );
  }

  // HTTP driver — works on Cloudflare Workers without WebSocket/pg Pool.
  const adapter = new PrismaNeonHTTP(connectionString, {
    arrayMode: false,
    fullResults: false,
  });
  return new PrismaClient({ adapter });
}

/** One Prisma client per request — required on Cloudflare Workers (no global pool reuse). */
export const getPrisma = cache(createPrismaClient);

/** Backward-compatible export; delegates to the per-request cached client. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
