-- Phase 8: AI Creative Director & Brand Intelligence

CREATE TABLE "creative_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Creative Director Session',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "memoryJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "creative_sessions_workspaceId_projectId_idx" ON "creative_sessions"("workspaceId", "projectId");

CREATE TABLE "creative_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'cd-v1.0',
    "contextSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "creative_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "creative_messages_sessionId_createdAt_idx" ON "creative_messages"("sessionId", "createdAt");

CREATE TABLE "creative_assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "assessmentType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "overallScore" INTEGER,
    "isAdvisory" BOOLEAN NOT NULL DEFAULT true,
    "disclaimer" TEXT NOT NULL DEFAULT 'Advisory creative assessment only. Does not predict commercial success or guarantee trademark/legal availability.',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'cd-eval-v1.0',
    "scoringCriteriaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_assessments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "creative_assessments_workspaceId_projectId_idx" ON "creative_assessments"("workspaceId", "projectId");

CREATE TABLE "assessment_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "judgmentType" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "explanation" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.75,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "recommendation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_categories_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "creative_assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "assessment_categories_assessmentId_idx" ON "assessment_categories"("assessmentId");

CREATE TABLE "assessment_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "assetId" TEXT,
    "assetVersion" INTEGER,
    "measurementJson" TEXT NOT NULL DEFAULT '{}',
    "finding" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_evidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "creative_assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "assessment_evidence_assessmentId_idx" ON "assessment_evidence"("assessmentId");

CREATE TABLE "design_critic_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "overallScore" INTEGER,
    "critiqueJson" TEXT NOT NULL DEFAULT '{}',
    "regionFindingsJson" TEXT NOT NULL DEFAULT '[]',
    "provider" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'cd-critic-v1.0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_critic_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "design_critic_reports_workspaceId_projectId_idx" ON "design_critic_reports"("workspaceId", "projectId");

CREATE TABLE "brand_consistency_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "consistencyScore" INTEGER NOT NULL,
    "issuesJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_consistency_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_consistency_reports_workspaceId_projectId_idx" ON "brand_consistency_reports"("workspaceId", "projectId");

CREATE TABLE "creative_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "affectedAssetsJson" TEXT NOT NULL DEFAULT '[]',
    "implementationApproach" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "editedContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "creative_recommendations_workspaceId_projectId_status_idx" ON "creative_recommendations"("workspaceId", "projectId", "status");

CREATE TABLE "creative_briefs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "briefJson" TEXT NOT NULL DEFAULT '{}',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_briefs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "creative_briefs_workspaceId_projectId_idx" ON "creative_briefs"("workspaceId", "projectId");

CREATE TABLE "brand_comparisons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "comparisonType" TEXT NOT NULL,
    "itemIdsJson" TEXT NOT NULL DEFAULT '[]',
    "criteriaJson" TEXT NOT NULL DEFAULT '{}',
    "evaluationJson" TEXT NOT NULL DEFAULT '{}',
    "aiRecommendation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_comparisons_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_comparisons_workspaceId_projectId_idx" ON "brand_comparisons"("workspaceId", "projectId");

CREATE TABLE "assessment_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "assessment_history_workspaceId_projectId_createdAt_idx" ON "assessment_history"("workspaceId", "projectId", "createdAt");

CREATE TABLE "brand_intelligence_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "assetRefsJson" TEXT NOT NULL DEFAULT '[]',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_intelligence_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_intelligence_reports_workspaceId_projectId_idx" ON "brand_intelligence_reports"("workspaceId", "projectId");
