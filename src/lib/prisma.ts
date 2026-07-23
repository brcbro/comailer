import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Safely set webSocketConstructor in Node environments where global WebSocket is missing
if (typeof window === "undefined" && typeof WebSocket === "undefined") {
  try {
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // Ignore in edge/serverless environments where global WebSocket exists natively
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = (process.env.DATABASE_URL || "").trim().replace(/^["']|["']$/g, "");

  if (
    connectionString &&
    (connectionString.startsWith("postgres://") ||
      connectionString.startsWith("postgresql://"))
  ) {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
