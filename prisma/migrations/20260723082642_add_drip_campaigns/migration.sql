-- CreateTable
CREATE TABLE "DripCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "smtpConfigId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "templateId" TEXT,
    "campaignId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "batchSize" INTEGER NOT NULL DEFAULT 5,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "dayKey" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DripCampaign_smtpConfigId_fkey" FOREIGN KEY ("smtpConfigId") REFERENCES "SmtpConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DripCampaign_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DripCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DripCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DripRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dripCampaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" DATETIME,
    "recipientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DripRecipient_dripCampaignId_fkey" FOREIGN KEY ("dripCampaignId") REFERENCES "DripCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DripRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DripCampaign_campaignId_key" ON "DripCampaign"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "DripRecipient_recipientId_key" ON "DripRecipient"("recipientId");

-- CreateIndex
CREATE INDEX "DripRecipient_dripCampaignId_status_position_idx" ON "DripRecipient"("dripCampaignId", "status", "position");
