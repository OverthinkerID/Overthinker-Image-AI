-- Phase 11: AI Marketing & Brand Growth Studio
CREATE TABLE "marketing_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "marketing_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "marketing_projects_workspaceId_projectId_deletedAt_idx" ON "marketing_projects"("workspaceId", "projectId", "deletedAt");

CREATE TABLE "marketing_strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "marketingProjectId" TEXT,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "objectivesJson" TEXT NOT NULL DEFAULT '[]',
    "funnelPlanJson" TEXT NOT NULL DEFAULT '{}',
    "channelMixJson" TEXT NOT NULL DEFAULT '[]',
    "messagingPillarsJson" TEXT NOT NULL DEFAULT '[]',
    "kpiTargetsJson" TEXT NOT NULL DEFAULT '[]',
    "budgetAllocationJson" TEXT NOT NULL DEFAULT '{}',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "marketing_strategies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketing_strategies_marketingProjectId_fkey" FOREIGN KEY ("marketingProjectId") REFERENCES "marketing_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "marketing_strategies_workspaceId_projectId_idx" ON "marketing_strategies"("workspaceId", "projectId");

CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "marketingProjectId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "stage" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "workflowStateJson" TEXT NOT NULL DEFAULT '{}',
    "exportPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "marketing_campaigns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketing_campaigns_marketingProjectId_fkey" FOREIGN KEY ("marketingProjectId") REFERENCES "marketing_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "marketing_campaigns_workspaceId_projectId_status_idx" ON "marketing_campaigns"("workspaceId", "projectId", "status");

CREATE TABLE "campaign_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "budgetShare" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_channels_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "campaign_channels_workspaceId_campaignId_idx" ON "campaign_channels"("workspaceId", "campaignId");

CREATE TABLE "content_pillars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ratioPct" INTEGER NOT NULL DEFAULT 25,
    "anglesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_pillars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "content_pillars_workspaceId_projectId_idx" ON "content_pillars"("workspaceId", "projectId");

CREATE TABLE "content_ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pillarId" TEXT,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_ideas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_ideas_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "content_pillars" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "content_ideas_workspaceId_projectId_idx" ON "content_ideas"("workspaceId", "projectId");

CREATE TABLE "marketing_contents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "campaignId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hook" TEXT,
    "cta" TEXT,
    "hashtagsJson" TEXT NOT NULL DEFAULT '[]',
    "visualPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "marketing_contents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketing_contents_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "marketing_contents_workspaceId_projectId_platform_idx" ON "marketing_contents"("workspaceId", "projectId", "platform");

CREATE TABLE "content_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "headline" TEXT,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "tone" TEXT,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_variants_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "marketing_contents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "content_variants_workspaceId_contentId_idx" ON "content_variants"("workspaceId", "contentId");

CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "brandAssetId" TEXT,
    "assetType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_assets_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "marketing_contents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "content_assets_workspaceId_contentId_idx" ON "content_assets"("workspaceId", "contentId");

CREATE TABLE "content_calendars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "marketingProjectId" TEXT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "viewMode" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "content_calendars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_calendars_marketingProjectId_fkey" FOREIGN KEY ("marketingProjectId") REFERENCES "marketing_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "content_calendars_workspaceId_projectId_idx" ON "content_calendars"("workspaceId", "projectId");

CREATE TABLE "content_schedule_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "contentId" TEXT,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "content_schedule_items_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "content_calendars" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_schedule_items_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "marketing_contents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "content_schedule_items_workspaceId_calendarId_scheduledAt_idx" ON "content_schedule_items"("workspaceId", "calendarId", "scheduledAt");

CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "oauthState" TEXT,
    "encryptedToken" TEXT,
    "encryptedRefresh" TEXT,
    "tokenIv" TEXT,
    "tokenAuthTag" TEXT,
    "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
    "lastSyncedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "platform_connections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "platform_connections_workspaceId_projectId_platform_idx" ON "platform_connections"("workspaceId", "projectId", "platform");

CREATE TABLE "platform_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_permissions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "platform_connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "platform_permissions_connectionId_idx" ON "platform_permissions"("connectionId");

CREATE TABLE "publishing_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT,
    "platform" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "publishing_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publishing_accounts_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "platform_connections" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "publishing_accounts_workspaceId_projectId_idx" ON "publishing_accounts"("workspaceId", "projectId");

CREATE TABLE "publishing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentId" TEXT,
    "accountId" TEXT,
    "platform" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "preflightJson" TEXT NOT NULL DEFAULT '{}',
    "externalPostId" TEXT,
    "platformConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "scheduledFor" DATETIME,
    "dispatchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "publishing_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publishing_jobs_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "marketing_contents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "publishing_jobs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "publishing_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "publishing_jobs_idempotencyKey_key" ON "publishing_jobs"("idempotencyKey");
CREATE INDEX "publishing_jobs_workspaceId_projectId_status_idx" ON "publishing_jobs"("workspaceId", "projectId", "status");

CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "marketingCampaignId" TEXT,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "targetingJson" TEXT NOT NULL DEFAULT '{}',
    "budgetEstimateJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ad_campaigns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ad_campaigns_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "marketing_campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ad_campaigns_workspaceId_projectId_idx" ON "ad_campaigns"("workspaceId", "projectId");

CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "adCampaignId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL DEFAULT 'A',
    "assetPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_creatives_adCampaignId_fkey" FOREIGN KEY ("adCampaignId") REFERENCES "ad_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ad_creatives_workspaceId_adCampaignId_idx" ON "ad_creatives"("workspaceId", "adCampaignId");

CREATE TABLE "landing_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "htmlContent" TEXT NOT NULL,
    "cssContent" TEXT NOT NULL,
    "jsContent" TEXT NOT NULL DEFAULT '',
    "isSanitized" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "landing_pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "landing_pages_workspaceId_projectId_idx" ON "landing_pages"("workspaceId", "projectId");

CREATE TABLE "marketing_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "periodDate" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "ctr" REAL NOT NULL DEFAULT 0,
    "cpcCents" REAL NOT NULL DEFAULT 0,
    "dataSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_analytics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "marketing_analytics_workspaceId_projectId_periodDate_idx" ON "marketing_analytics"("workspaceId", "projectId", "periodDate");

CREATE TABLE "marketing_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "actualSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "calculatedKpisJson" TEXT NOT NULL DEFAULT '{}',
    "aiInsightsJson" TEXT NOT NULL DEFAULT '[]',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "marketing_reports_workspaceId_projectId_idx" ON "marketing_reports"("workspaceId", "projectId");

CREATE TABLE "marketing_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "marketing_recommendations_workspaceId_projectId_idx" ON "marketing_recommendations"("workspaceId", "projectId");

CREATE TABLE "campaign_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "comment" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_approvals_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "campaign_approvals_workspaceId_campaignId_idx" ON "campaign_approvals"("workspaceId", "campaignId");
