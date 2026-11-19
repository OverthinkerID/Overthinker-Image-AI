CREATE TABLE "brand_analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "logoId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "aspectLabel" TEXT NOT NULL,
    "hasTransparency" BOOLEAN NOT NULL DEFAULT false,
    "transparencyRatio" REAL NOT NULL DEFAULT 0,
    "backgroundType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "backgroundHex" TEXT,
    "isMonochrome" BOOLEAN NOT NULL DEFAULT false,
    "colorCount" INTEGER NOT NULL DEFAULT 0,
    "shapeStyle" TEXT NOT NULL DEFAULT 'geometric',
    "visualElementsJson" TEXT NOT NULL DEFAULT '[]',
    "extractedText" TEXT,
    "hasText" BOOLEAN NOT NULL DEFAULT false,
    "ocrConfidence" REAL NOT NULL DEFAULT 0,
    "rawAnalysisJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_analysis_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "LogoAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "brand_dna" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "analysisId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "brandName" TEXT NOT NULL,
    "industry" TEXT,
    "brandDescription" TEXT,
    "logoCharacteristicsJson" TEXT NOT NULL DEFAULT '{}',
    "visualDirection" TEXT,
    "designRulesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_dna_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_dna_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "brand_analysis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "brand_colors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandDnaId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "hex" TEXT NOT NULL,
    "rgb" TEXT NOT NULL,
    "hsl" TEXT NOT NULL,
    "dominance" REAL NOT NULL DEFAULT 0,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_colors_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "brand_typography" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandDnaId" TEXT NOT NULL,
    "extractedText" TEXT,
    "detectedStyle" TEXT NOT NULL DEFAULT 'unknown',
    "identificationConfidence" REAL NOT NULL DEFAULT 0,
    "confidenceNote" TEXT NOT NULL,
    "headingFont" TEXT NOT NULL,
    "bodyFont" TEXT NOT NULL,
    "headingFallback" TEXT NOT NULL,
    "bodyFallback" TEXT NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_typography_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "brand_personality" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandDnaId" TEXT NOT NULL,
    "personalityTraitsJson" TEXT NOT NULL DEFAULT '[]',
    "visualStyle" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "brandPositioning" TEXT NOT NULL,
    "brandTone" TEXT NOT NULL,
    "designRecommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "providerType" TEXT NOT NULL DEFAULT 'heuristic',
    "modelName" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_personality_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brand_analysis_projectId_idx" ON "brand_analysis"("projectId");
CREATE INDEX "brand_analysis_logoId_idx" ON "brand_analysis"("logoId");
CREATE UNIQUE INDEX "brand_dna_projectId_version_key" ON "brand_dna"("projectId", "version");
CREATE INDEX "brand_dna_projectId_status_idx" ON "brand_dna"("projectId", "status");
CREATE INDEX "brand_colors_brandDnaId_role_idx" ON "brand_colors"("brandDnaId", "role");
CREATE UNIQUE INDEX "brand_typography_brandDnaId_key" ON "brand_typography"("brandDnaId");
CREATE UNIQUE INDEX "brand_personality_brandDnaId_key" ON "brand_personality"("brandDnaId");
