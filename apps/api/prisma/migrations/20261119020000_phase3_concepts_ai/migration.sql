CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'HYBRID',
    "providerType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "defaultModel" TEXT,
    "apiKeyRef" TEXT,
    "hasApiKey" BOOLEAN NOT NULL DEFAULT false,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "comfyui_workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "workflowJson" TEXT NOT NULL,
    "defaultParamsJson" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "brand_concepts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "brandDnaId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "conceptName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visualDirection" TEXT NOT NULL,
    "moodboardJson" TEXT NOT NULL DEFAULT '{}',
    "colorPaletteJson" TEXT NOT NULL DEFAULT '[]',
    "typographyJson" TEXT NOT NULL DEFAULT '{}',
    "logoApplicationDirection" TEXT NOT NULL,
    "graphicElementsJson" TEXT NOT NULL DEFAULT '[]',
    "mockupPreviewsJson" TEXT NOT NULL DEFAULT '[]',
    "promptUsed" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_concepts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_concepts_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "concept_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "conceptName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visualDirection" TEXT NOT NULL,
    "colorPaletteJson" TEXT NOT NULL DEFAULT '[]',
    "typographyJson" TEXT NOT NULL DEFAULT '{}',
    "mockupPreviewsJson" TEXT NOT NULL DEFAULT '[]',
    "revisionNote" TEXT,
    "promptUsed" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "concept_revisions_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "brandDnaId" TEXT,
    "conceptId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "prompt" TEXT NOT NULL,
    "workflowId" TEXT,
    "workflowVersion" TEXT,
    "parametersJson" TEXT NOT NULL DEFAULT '{}',
    "outputRefsJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ai_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_jobs_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_jobs_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_provider_configs_providerType_key" ON "ai_provider_configs"("providerType");
CREATE UNIQUE INDEX "comfyui_workflows_name_key" ON "comfyui_workflows"("name");
CREATE INDEX "brand_concepts_projectId_categoryKey_idx" ON "brand_concepts"("projectId", "categoryKey");
CREATE INDEX "brand_concepts_brandDnaId_idx" ON "brand_concepts"("brandDnaId");
CREATE UNIQUE INDEX "concept_revisions_conceptId_version_key" ON "concept_revisions"("conceptId", "version");
CREATE INDEX "ai_jobs_projectId_status_idx" ON "ai_jobs"("projectId", "status");
CREATE INDEX "ai_jobs_conceptId_idx" ON "ai_jobs"("conceptId");
