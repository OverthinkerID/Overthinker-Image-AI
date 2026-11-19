-- Phase 9: Advanced AI Image & Design Editing

CREATE TABLE "image_editing_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "sourceAssetId" TEXT,
    "originalStoragePath" TEXT NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "originalSha256" TEXT NOT NULL,
    "originalWidth" INTEGER NOT NULL,
    "originalHeight" INTEGER NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "isApprovedLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_editing_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "image_editing_projects_workspaceId_projectId_idx" ON "image_editing_projects"("workspaceId", "projectId");

CREATE TABLE "image_editing_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editingProjectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operationType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "adjustmentsJson" TEXT NOT NULL DEFAULT '{}',
    "changeNote" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_editing_versions_editingProjectId_fkey" FOREIGN KEY ("editingProjectId") REFERENCES "image_editing_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "image_editing_versions_editingProjectId_version_key" ON "image_editing_versions"("editingProjectId", "version");

CREATE TABLE "image_masks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editingProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maskType" TEXT NOT NULL DEFAULT 'EDITABLE',
    "geometryJson" TEXT NOT NULL DEFAULT '{}',
    "featherPx" INTEGER NOT NULL DEFAULT 0,
    "inverted" BOOLEAN NOT NULL DEFAULT false,
    "maskStoragePath" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_masks_editingProjectId_fkey" FOREIGN KEY ("editingProjectId") REFERENCES "image_editing_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "image_masks_editingProjectId_idx" ON "image_masks"("editingProjectId");

CREATE TABLE "protected_regions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editingProjectId" TEXT NOT NULL,
    "regionType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "protectedAssetId" TEXT,
    "boundsJson" TEXT NOT NULL DEFAULT '{}',
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "protected_regions_editingProjectId_fkey" FOREIGN KEY ("editingProjectId") REFERENCES "image_editing_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "protected_regions_editingProjectId_idx" ON "protected_regions"("editingProjectId");

CREATE TABLE "image_editing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "editingProjectId" TEXT NOT NULL,
    "aiJobId" TEXT,
    "jobType" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "workflowVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "maskId" TEXT,
    "outputVersionId" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_editing_jobs_editingProjectId_fkey" FOREIGN KEY ("editingProjectId") REFERENCES "image_editing_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "image_editing_jobs_workspaceId_projectId_status_idx" ON "image_editing_jobs"("workspaceId", "projectId", "status");

CREATE TABLE "image_editing_parameters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "prompt" TEXT,
    "negativePrompt" TEXT,
    "seed" INTEGER,
    "denoise" REAL,
    "upscaleFactor" INTEGER,
    "extraJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_editing_parameters_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "image_editing_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "image_editing_parameters_jobId_key" ON "image_editing_parameters"("jobId");

CREATE TABLE "image_editing_workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presetType" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "concurrencyLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_editing_workflows_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "image_editing_workflows_workspaceId_projectId_idx" ON "image_editing_workflows"("workspaceId", "projectId");

CREATE TABLE "image_editing_workflow_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "image_editing_workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "image_editing_workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "image_editing_workflow_steps_workflowId_stepOrder_key" ON "image_editing_workflow_steps"("workflowId", "stepOrder");

CREATE TABLE "image_comparisons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editingProjectId" TEXT NOT NULL,
    "beforeVersion" INTEGER NOT NULL,
    "afterVersion" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIDE_BY_SIDE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_comparisons_editingProjectId_fkey" FOREIGN KEY ("editingProjectId") REFERENCES "image_editing_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "image_comparisons_editingProjectId_idx" ON "image_comparisons"("editingProjectId");
