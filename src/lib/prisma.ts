import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  // Cloudflare Edge environment check
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_RUNTIME === "edge" &&
    connectionString
  ) {
    try {
      const { PrismaNeon } = require("@prisma/adapter-neon");
      const { Pool } = require("@neondatabase/serverless");
      const pool = new Pool({ connectionString });
      const adapter = new PrismaNeon(pool);
      return new PrismaClient({ adapter });
    } catch {
      // Fallback
    }
  }

  // Standard Node.js runtime (local dev & serverless Node)
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
