CREATE TABLE "mockup_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1200,
    "height" INTEGER NOT NULL DEFAULT 900,
    "placementJson" TEXT NOT NULL DEFAULT '{}',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mockup_templates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "mockup_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "conceptId" TEXT,
    "sourceAssetId" TEXT,
    "designDocumentId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1200,
    "height" INTEGER NOT NULL DEFAULT 900,
    "sceneConfigJson" TEXT NOT NULL DEFAULT '{}',
    "renderedPath" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mockup_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mockup_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "mockup_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "mockup_documents_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "mockup_documents_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "brand_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "mockup_documents_designDocumentId_fkey" FOREIGN KEY ("designDocumentId") REFERENCES "design_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "mockup_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mockupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sceneConfigJson" TEXT NOT NULL,
    "renderedPath" TEXT,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mockup_versions_mockupId_fkey" FOREIGN KEY ("mockupId") REFERENCES "mockup_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "mockup_render_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "mockupId" TEXT,
    "provider" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "sourceAssetRefs" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "mockup_render_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mockup_render_jobs_mockupId_fkey" FOREIGN KEY ("mockupId") REFERENCES "mockup_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "brand_guidelines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "title" TEXT NOT NULL,
    "layoutConfigJson" TEXT NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_guidelines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_guidelines_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "guideline_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guidelineId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "imageRefsJson" TEXT NOT NULL DEFAULT '[]',
    "layoutType" TEXT NOT NULL DEFAULT 'STANDARD',
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "guideline_sections_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "brand_guidelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "guideline_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guidelineId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guideline_versions_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "brand_guidelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "brand_presentations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "title" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_presentations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_presentations_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "presentation_slides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentationId" TEXT NOT NULL,
    "slideType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'SPLIT',
    "imageRefsJson" TEXT NOT NULL DEFAULT '[]',
    "orderIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "presentation_slides_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "brand_presentations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "presentation_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presentation_versions_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "brand_presentations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mockup_templates_category_templateKey_idx" ON "mockup_templates"("category", "templateKey");
CREATE INDEX "mockup_documents_projectId_category_idx" ON "mockup_documents"("projectId", "category");
CREATE UNIQUE INDEX "mockup_versions_mockupId_version_key" ON "mockup_versions"("mockupId", "version");
CREATE INDEX "mockup_render_jobs_projectId_status_idx" ON "mockup_render_jobs"("projectId", "status");
CREATE INDEX "brand_guidelines_projectId_idx" ON "brand_guidelines"("projectId");
CREATE INDEX "guideline_sections_guidelineId_orderIndex_idx" ON "guideline_sections"("guidelineId", "orderIndex");
CREATE UNIQUE INDEX "guideline_versions_guidelineId_version_key" ON "guideline_versions"("guidelineId", "version");
CREATE INDEX "brand_presentations_projectId_idx" ON "brand_presentations"("projectId");
CREATE INDEX "presentation_slides_presentationId_orderIndex_idx" ON "presentation_slides"("presentationId", "orderIndex");
CREATE UNIQUE INDEX "presentation_versions_presentationId_version_key" ON "presentation_versions"("presentationId", "version");
