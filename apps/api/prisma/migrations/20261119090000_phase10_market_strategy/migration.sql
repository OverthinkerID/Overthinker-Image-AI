-- Phase 10: Market Research & Brand Strategy Intelligence

CREATE TABLE "market_research_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "brandName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "country" TEXT,
    "targetRegion" TEXT,
    "productType" TEXT,
    "targetMarket" TEXT,
    "priceRange" TEXT,
    "businessDesc" TEXT,
    "researchGoal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_research_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "market_research_projects_workspaceId_projectId_deletedAt_idx" ON "market_research_projects"("workspaceId", "projectId", "deletedAt");

CREATE TABLE "market_research_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publisher" TEXT,
    "publishedAt" TEXT,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findingCategory" TEXT NOT NULL DEFAULT 'AI_ANALYSIS',
    "confidence" REAL NOT NULL DEFAULT 0.75,
    "excerpt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_research_sources_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "market_research_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "market_research_sources_workspaceId_researchProjectId_idx" ON "market_research_sources"("workspaceId", "researchProjectId");

CREATE TABLE "industry_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "characteristicsJson" TEXT NOT NULL DEFAULT '[]',
    "consumerBehavior" TEXT NOT NULL,
    "opportunitiesJson" TEXT NOT NULL DEFAULT '[]',
    "challengesJson" TEXT NOT NULL DEFAULT '[]',
    "threatsJson" TEXT NOT NULL DEFAULT '[]',
    "swotJson" TEXT NOT NULL DEFAULT '{}',
    "pestleJson" TEXT NOT NULL DEFAULT '{}',
    "marketGapsJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "provenanceJson" TEXT NOT NULL DEFAULT '{}',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "industry_analyses_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "market_research_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "industry_analyses_workspaceId_researchProjectId_idx" ON "industry_analyses"("workspaceId", "researchProjectId");

CREATE TABLE "market_trends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "findingCategory" TEXT NOT NULL DEFAULT 'AI_ANALYSIS',
    "confidence" REAL NOT NULL DEFAULT 0.75,
    "sourceRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_trends_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "market_research_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "market_trends_workspaceId_researchProjectId_idx" ON "market_trends"("workspaceId", "researchProjectId");

CREATE TABLE "competitors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "competitorType" TEXT NOT NULL DEFAULT 'DIRECT',
    "website" TEXT,
    "positioning" TEXT,
    "valueProposition" TEXT,
    "priceTier" TEXT,
    "productsJson" TEXT NOT NULL DEFAULT '[]',
    "strengthsJson" TEXT NOT NULL DEFAULT '[]',
    "weaknessesJson" TEXT NOT NULL DEFAULT '[]',
    "dataProvenance" TEXT NOT NULL DEFAULT 'USER_INPUT',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "competitors_workspaceId_projectId_deletedAt_idx" ON "competitors"("workspaceId", "projectId", "deletedAt");

CREATE TABLE "competitor_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "visualNotes" TEXT,
    "positioningNotes" TEXT NOT NULL,
    "differentiationGap" TEXT NOT NULL,
    "dataProvenance" TEXT NOT NULL DEFAULT 'AI_ESTIMATE',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitor_analyses_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "competitor_analyses_workspaceId_competitorId_idx" ON "competitor_analyses"("workspaceId", "competitorId");

CREATE TABLE "competitor_comparisons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorIdsJson" TEXT NOT NULL DEFAULT '[]',
    "matrixJson" TEXT NOT NULL DEFAULT '[]',
    "positioningMapJson" TEXT NOT NULL DEFAULT '[]',
    "marketGapsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "competitor_comparisons_workspaceId_projectId_idx" ON "competitor_comparisons"("workspaceId", "projectId");

CREATE TABLE "audience_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "demographicJson" TEXT NOT NULL DEFAULT '{}',
    "geographicJson" TEXT NOT NULL DEFAULT '{}',
    "psychographicJson" TEXT NOT NULL DEFAULT '{}',
    "behavioralJson" TEXT NOT NULL DEFAULT '{}',
    "needsJson" TEXT NOT NULL DEFAULT '[]',
    "painPointsJson" TEXT NOT NULL DEFAULT '[]',
    "triggersJson" TEXT NOT NULL DEFAULT '[]',
    "dataSourceType" TEXT NOT NULL DEFAULT 'AI_HYPOTHESIS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audience_segments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audience_segments_workspaceId_projectId_idx" ON "audience_segments"("workspaceId", "projectId");

CREATE TABLE "customer_personas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "ageRange" TEXT,
    "location" TEXT,
    "occupation" TEXT,
    "incomeRange" TEXT,
    "lifestyle" TEXT,
    "interestsJson" TEXT NOT NULL DEFAULT '[]',
    "goalsJson" TEXT NOT NULL DEFAULT '[]',
    "painPointsJson" TEXT NOT NULL DEFAULT '[]',
    "needsJson" TEXT NOT NULL DEFAULT '[]',
    "motivationsJson" TEXT NOT NULL DEFAULT '[]',
    "barriersJson" TEXT NOT NULL DEFAULT '[]',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "expectations" TEXT,
    "dataSourceType" TEXT NOT NULL DEFAULT 'AI_HYPOTHESIS',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_personas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_personas_workspaceId_projectId_deletedAt_idx" ON "customer_personas"("workspaceId", "projectId", "deletedAt");

CREATE TABLE "customer_journeys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stagesJson" TEXT NOT NULL DEFAULT '[]',
    "dataSourceType" TEXT NOT NULL DEFAULT 'AI_HYPOTHESIS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_journeys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_journeys_workspaceId_projectId_idx" ON "customer_journeys"("workspaceId", "projectId");

CREATE TABLE "brand_positionings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandDnaId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "positioningStmt" TEXT NOT NULL,
    "uvp" TEXT NOT NULL,
    "usp" TEXT NOT NULL,
    "differentiation" TEXT NOT NULL,
    "brandPromise" TEXT NOT NULL,
    "brandValuesJson" TEXT NOT NULL DEFAULT '[]',
    "brandPersonality" TEXT NOT NULL,
    "brandArchetype" TEXT NOT NULL,
    "brandVoice" TEXT NOT NULL,
    "keyMessagingJson" TEXT NOT NULL DEFAULT '[]',
    "reasonsToBelieveJson" TEXT NOT NULL DEFAULT '[]',
    "strategicDirection" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_positionings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_positionings_workspaceId_projectId_isApproved_idx" ON "brand_positionings"("workspaceId", "projectId", "isApproved");

CREATE TABLE "brand_naming_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "namingConcept" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL,
    "industrySuitability" TEXT NOT NULL,
    "audienceSuitability" TEXT NOT NULL,
    "personalityAlignment" TEXT NOT NULL,
    "strengthsJson" TEXT NOT NULL DEFAULT '[]',
    "weaknessesJson" TEXT NOT NULL DEFAULT '[]',
    "similarityNote" TEXT,
    "domainCheckStatus" TEXT NOT NULL DEFAULT 'EXTERNAL_PROVIDER_NOT_CONFIGURED',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer" TEXT NOT NULL DEFAULT 'Advisory naming candidate only. Does not verify trademark availability or legal clearance.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_naming_candidates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_naming_candidates_workspaceId_projectId_idx" ON "brand_naming_candidates"("workspaceId", "projectId");

CREATE TABLE "brand_tagline_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "audienceSuitability" TEXT NOT NULL,
    "positioningAlignment" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_tagline_candidates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_tagline_candidates_workspaceId_projectId_idx" ON "brand_tagline_candidates"("workspaceId", "projectId");

CREATE TABLE "brand_strategy_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_strategy_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_strategy_reports_workspaceId_projectId_idx" ON "brand_strategy_reports"("workspaceId", "projectId");

CREATE TABLE "strategy_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "strategy_recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "strategy_recommendations_workspaceId_projectId_idx" ON "strategy_recommendations"("workspaceId", "projectId");

CREATE TABLE "strategy_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "strategy_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "brand_strategy_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "strategy_versions_reportId_version_key" ON "strategy_versions"("reportId", "version");
