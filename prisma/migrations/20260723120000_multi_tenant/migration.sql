-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organizationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default Internal organization for existing data
INSERT INTO "Organization" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('org_internal_default', 'Internal', 'internal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add organizationId columns (nullable first for backfill)
ALTER TABLE "SmtpConfig" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Template" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "DripCampaign" ADD COLUMN "organizationId" TEXT;

UPDATE "SmtpConfig" SET "organizationId" = 'org_internal_default' WHERE "organizationId" IS NULL;
UPDATE "Template" SET "organizationId" = 'org_internal_default' WHERE "organizationId" IS NULL;
UPDATE "Campaign" SET "organizationId" = 'org_internal_default' WHERE "organizationId" IS NULL;
UPDATE "DripCampaign" SET "organizationId" = 'org_internal_default' WHERE "organizationId" IS NULL;

ALTER TABLE "SmtpConfig" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DripCampaign" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "SmtpConfig_organizationId_idx" ON "SmtpConfig"("organizationId");
CREATE INDEX "Template_organizationId_idx" ON "Template"("organizationId");
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");
CREATE INDEX "DripCampaign_organizationId_idx" ON "DripCampaign"("organizationId");

ALTER TABLE "SmtpConfig" ADD CONSTRAINT "SmtpConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DripCampaign" ADD CONSTRAINT "DripCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
