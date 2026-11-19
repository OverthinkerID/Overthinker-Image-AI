CREATE TABLE "brand_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aiProvider" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brand_assets_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "logo_variations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentLogoId" TEXT,
    "conceptId" TEXT,
    "variationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "svgContent" TEXT,
    "width" INTEGER NOT NULL DEFAULT 512,
    "height" INTEGER NOT NULL DEFAULT 512,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "logo_variations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "logo_variations_parentLogoId_fkey" FOREIGN KEY ("parentLogoId") REFERENCES "LogoAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "logo_variations_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "color_systems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "brandDnaId" TEXT,
    "conceptId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Brand Color System',
    "version" INTEGER NOT NULL DEFAULT 1,
    "palettesJson" TEXT NOT NULL DEFAULT '{}',
    "contrastJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "color_systems_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "color_systems_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "color_systems_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "typography_systems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "brandDnaId" TEXT,
    "conceptId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Brand Typography System',
    "version" INTEGER NOT NULL DEFAULT 1,
    "rolesJson" TEXT NOT NULL DEFAULT '{}',
    "customFontsJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "typography_systems_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "typography_systems_brandDnaId_fkey" FOREIGN KEY ("brandDnaId") REFERENCES "brand_dna" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "typography_systems_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "graphic_elements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "elementType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'SVG',
    "storagePath" TEXT NOT NULL,
    "svgContent" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aiProvider" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "graphic_elements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "graphic_elements_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "design_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "canvasJson" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "design_templates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "design_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "canvasJson" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "design_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "design_documents_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "brand_concepts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "design_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "design_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "design_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "canvasJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "design_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "asset_exports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "format" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "dpi" INTEGER NOT NULL DEFAULT 72,
    "transparent" BOOLEAN NOT NULL DEFAULT false,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_exports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brand_assets_projectId_category_idx" ON "brand_assets"("projectId", "category");
CREATE INDEX "brand_assets_conceptId_idx" ON "brand_assets"("conceptId");
CREATE INDEX "logo_variations_projectId_variationType_idx" ON "logo_variations"("projectId", "variationType");
CREATE INDEX "color_systems_projectId_version_idx" ON "color_systems"("projectId", "version");
CREATE INDEX "typography_systems_projectId_version_idx" ON "typography_systems"("projectId", "version");
CREATE INDEX "graphic_elements_projectId_elementType_idx" ON "graphic_elements"("projectId", "elementType");
CREATE INDEX "design_templates_category_templateKey_idx" ON "design_templates"("category", "templateKey");
CREATE INDEX "design_documents_projectId_idx" ON "design_documents"("projectId");
CREATE UNIQUE INDEX "design_versions_documentId_version_key" ON "design_versions"("documentId", "version");
CREATE INDEX "asset_exports_projectId_format_idx" ON "asset_exports"("projectId", "format");
