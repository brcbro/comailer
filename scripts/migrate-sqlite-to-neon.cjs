#!/usr/bin/env node
/**
 * One-off: copy all app data from prisma/dev.db (SQLite) into Neon PostgreSQL.
 * Usage: node scripts/migrate-sqlite-to-neon.cjs [--force]
 */
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const Database = require("better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHTTP } = require("@prisma/adapter-neon");

const SQLITE_PATH = path.join(__dirname, "..", "prisma", "dev.db");
const force = process.argv.includes("--force");

const TABLES = [
  "SmtpConfig",
  "Sender",
  "Template",
  "Campaign",
  "Recipient",
  "TrackingEvent",
  "DripCampaign",
  "DripRecipient",
];

function bool(v) {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

function readSqlite() {
  const db = new Database(SQLITE_PATH, { readonly: true });
  const data = {};
  for (const table of TABLES) {
    try {
      data[table] = db.prepare(`SELECT * FROM "${table}"`).all();
    } catch {
      data[table] = [];
    }
  }
  db.close();
  return data;
}

async function neonCounts(prisma) {
  return {
    SmtpConfig: await prisma.smtpConfig.count(),
    Sender: await prisma.sender.count(),
    Template: await prisma.template.count(),
    Campaign: await prisma.campaign.count(),
    Recipient: await prisma.recipient.count(),
    TrackingEvent: await prisma.trackingEvent.count(),
    DripCampaign: await prisma.dripCampaign.count(),
    DripRecipient: await prisma.dripRecipient.count(),
  };
}

async function main() {
  console.log("SQLite:", SQLITE_PATH);
  const sqlite = readSqlite();
  for (const table of TABLES) {
    console.log(`  ${table}: ${sqlite[table].length} rows`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeonHTTP(process.env.DATABASE_URL.replace(/^["']|["']$/g, ""), {
      arrayMode: false,
      fullResults: false,
    }),
  });
  const before = await neonCounts(prisma);
  console.log("\nNeon (before):");
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k}: ${v} rows`);
  }

  const sqliteTotal = Object.values(sqlite).reduce((n, rows) => n + rows.length, 0);
  const neonTotal = Object.values(before).reduce((n, v) => n + v, 0);

  if (sqliteTotal === 0) {
    console.log("\nNothing to migrate — SQLite is empty.");
    await prisma.$disconnect();
    return;
  }

  if (neonTotal > 0 && !force) {
    console.error(
      "\nNeon already has data. Re-run with --force to wipe Neon app tables and re-import from SQLite."
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  if (force && neonTotal > 0) {
    console.log("\nClearing Neon app tables…");
    await prisma.trackingEvent.deleteMany();
    await prisma.dripRecipient.deleteMany();
    await prisma.recipient.deleteMany();
    await prisma.dripCampaign.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.sender.deleteMany();
    await prisma.template.deleteMany();
    await prisma.smtpConfig.deleteMany();
  }

  console.log("\nImporting…");

  for (const row of sqlite.SmtpConfig) {
    await prisma.smtpConfig.create({
      data: {
        id: row.id,
        name: row.name,
        mode: row.mode,
        domain: row.domain,
        bounceAddress: row.bounceAddress ?? null,
        region: row.region ?? "com",
        host: row.host ?? null,
        port: row.port ?? null,
        secure: bool(row.secure) ?? false,
        username: row.username ?? null,
        passwordEnc: row.passwordEnc ?? null,
        apiTokenEnc: row.apiTokenEnc ?? null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      },
    });
  }
  console.log(`  SmtpConfig: ${sqlite.SmtpConfig.length}`);

  for (const row of sqlite.Sender) {
    await prisma.sender.create({
      data: {
        id: row.id,
        smtpConfigId: row.smtpConfigId,
        email: row.email,
        displayName: row.displayName ?? null,
        createdAt: new Date(row.createdAt),
      },
    });
  }
  console.log(`  Sender: ${sqlite.Sender.length}`);

  for (const row of sqlite.Template) {
    await prisma.template.create({
      data: {
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        body: row.body,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      },
    });
  }
  console.log(`  Template: ${sqlite.Template.length}`);

  for (const row of sqlite.Campaign) {
    await prisma.campaign.create({
      data: {
        id: row.id,
        name: row.name,
        smtpConfigId: row.smtpConfigId,
        senderId: row.senderId ?? null,
        templateId: row.templateId ?? null,
        subject: row.subject,
        bodyType: row.bodyType,
        body: row.body,
        status: row.status ?? "draft",
        createdAt: new Date(row.createdAt),
      },
    });
  }
  console.log(`  Campaign: ${sqlite.Campaign.length}`);

  for (const row of sqlite.Recipient) {
    await prisma.recipient.create({
      data: {
        id: row.id,
        campaignId: row.campaignId,
        email: row.email,
        name: row.name ?? null,
        trackingId: row.trackingId,
        status: row.status ?? "pending",
        error: row.error ?? null,
        sentAt: row.sentAt ? new Date(row.sentAt) : null,
        createdAt: new Date(row.createdAt),
      },
    });
  }
  console.log(`  Recipient: ${sqlite.Recipient.length}`);

  for (const row of sqlite.TrackingEvent) {
    await prisma.trackingEvent.create({
      data: {
        id: row.id,
        recipientId: row.recipientId,
        type: row.type,
        url: row.url ?? null,
        ip: row.ip ?? null,
        userAgent: row.userAgent ?? null,
        createdAt: new Date(row.createdAt),
      },
    });
  }
  console.log(`  TrackingEvent: ${sqlite.TrackingEvent.length}`);

  for (const row of sqlite.DripCampaign) {
    await prisma.dripCampaign.create({
      data: {
        id: row.id,
        name: row.name,
        smtpConfigId: row.smtpConfigId,
        senderId: row.senderId,
        templateId: row.templateId ?? null,
        campaignId: row.campaignId ?? null,
        subject: row.subject,
        bodyType: row.bodyType,
        body: row.body,
        status: row.status ?? "paused",
        dailyLimit: row.dailyLimit ?? 100,
        batchSize: row.batchSize ?? 5,
        sentToday: row.sentToday ?? 0,
        dayKey: row.dayKey ?? "",
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      },
    });
  }
  console.log(`  DripCampaign: ${sqlite.DripCampaign.length}`);

  for (const row of sqlite.DripRecipient) {
    await prisma.dripRecipient.create({
      data: {
        id: row.id,
        dripCampaignId: row.dripCampaignId,
        email: row.email,
        name: row.name ?? null,
        position: row.position ?? 0,
        status: row.status ?? "pending",
        error: row.error ?? null,
        sentAt: row.sentAt ? new Date(row.sentAt) : null,
        recipientId: row.recipientId ?? null,
        createdAt: new Date(row.createdAt),
      },
    });
  }
  console.log(`  DripRecipient: ${sqlite.DripRecipient.length}`);

  const after = await neonCounts(prisma);
  console.log("\nNeon (after):");
  for (const [k, v] of Object.entries(after)) {
    console.log(`  ${k}: ${v} rows`);
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
