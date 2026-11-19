-- Phase 12: AI Brand Video & Motion Studio
CREATE TABLE "video_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "templateKey" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "durationSec" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "provider" TEXT NOT NULL DEFAULT 'local-ffmpeg',
    "model" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "video_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_projects_workspaceId_projectId_deletedAt_idx" ON "video_projects"("workspaceId", "projectId", "deletedAt");

CREATE TABLE "video_scripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id-ID',
    "narrationText" TEXT NOT NULL,
    "hook" TEXT,
    "cta" TEXT,
    "durationEstSec" INTEGER NOT NULL DEFAULT 15,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "video_scripts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_scripts_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_scripts_workspaceId_projectId_idx" ON "video_scripts"("workspaceId", "projectId");

CREATE TABLE "video_storyboards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "video_storyboards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_storyboards_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_storyboards_workspaceId_projectId_idx" ON "video_storyboards"("workspaceId", "projectId");

CREATE TABLE "video_scenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyboardId" TEXT NOT NULL,
    "sceneOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "narrationLine" TEXT,
    "durationSec" REAL NOT NULL DEFAULT 3.0,
    "motionStyle" TEXT NOT NULL DEFAULT 'SMOOTH_PAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_scenes_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "video_storyboards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_scenes_storyboardId_sceneOrder_idx" ON "video_scenes"("storyboardId", "sceneOrder");

CREATE TABLE "video_shots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "shotOrder" INTEGER NOT NULL,
    "cameraMove" TEXT NOT NULL DEFAULT 'STATIC',
    "framing" TEXT NOT NULL DEFAULT 'MEDIUM',
    "durationSec" REAL NOT NULL DEFAULT 3.0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_shots_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "video_scenes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_shots_sceneId_shotOrder_idx" ON "video_shots"("sceneId", "shotOrder");

CREATE TABLE "video_generation_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT,
    "jobType" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local-ffmpeg',
    "model" TEXT,
    "prompt" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputAssetId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "video_generation_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_generation_jobs_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "video_generation_jobs_workspaceId_projectId_status_idx" ON "video_generation_jobs"("workspaceId", "projectId", "status");

CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceLogoId" TEXT,
    "assetType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "durationSec" REAL NOT NULL DEFAULT 5.0,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "hasAlpha" BOOLEAN NOT NULL DEFAULT false,
    "preservesLogo" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT NOT NULL DEFAULT 'local-ffmpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_assets_workspaceId_projectId_idx" ON "video_assets"("workspaceId", "projectId");

CREATE TABLE "video_timelines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "durationSec" REAL NOT NULL DEFAULT 15.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "video_timelines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_timelines_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_timelines_workspaceId_projectId_idx" ON "video_timelines"("workspaceId", "projectId");

CREATE TABLE "video_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "trackType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_tracks_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "video_timelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_tracks_timelineId_orderIndex_idx" ON "video_tracks"("timelineId", "orderIndex");

CREATE TABLE "voice_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id-ID',
    "gender" TEXT,
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "consentNote" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local-tts',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "voice_profiles_workspaceId_projectId_idx" ON "voice_profiles"("workspaceId", "projectId");

CREATE TABLE "video_audio_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "voiceProfileId" TEXT,
    "audioType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id-ID',
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/wav',
    "durationSec" REAL NOT NULL DEFAULT 5.0,
    "provider" TEXT NOT NULL DEFAULT 'local-tts',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_audio_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_audio_assets_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "video_audio_assets_workspaceId_projectId_idx" ON "video_audio_assets"("workspaceId", "projectId");

CREATE TABLE "video_clips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "assetId" TEXT,
    "audioId" TEXT,
    "label" TEXT NOT NULL,
    "startSec" REAL NOT NULL DEFAULT 0,
    "durationSec" REAL NOT NULL DEFAULT 5,
    "trimInSec" REAL NOT NULL DEFAULT 0,
    "trimOutSec" REAL,
    "volume" REAL NOT NULL DEFAULT 1.0,
    "transformJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_clips_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "video_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_clips_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "video_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "video_clips_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "video_audio_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "video_clips_trackId_startSec_idx" ON "video_clips"("trackId", "startSec");

CREATE TABLE "video_transitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "transitionType" TEXT NOT NULL,
    "atSec" REAL NOT NULL,
    "durationSec" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_transitions_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "video_timelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_transitions_timelineId_idx" ON "video_transitions"("timelineId");

CREATE TABLE "video_text_overlays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "fontSize" INTEGER NOT NULL DEFAULT 48,
    "colorHex" TEXT NOT NULL DEFAULT '#FFFFFF',
    "startSec" REAL NOT NULL DEFAULT 0,
    "durationSec" REAL NOT NULL DEFAULT 3,
    "positionJson" TEXT NOT NULL DEFAULT '{"x":0.5,"y":0.8}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_text_overlays_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "video_timelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_text_overlays_timelineId_idx" ON "video_text_overlays"("timelineId");

CREATE TABLE "video_subtitles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id-ID',
    "format" TEXT NOT NULL DEFAULT 'SRT',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_subtitles_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "video_timelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_subtitles_timelineId_idx" ON "video_subtitles"("timelineId");

CREATE TABLE "video_export_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "format" TEXT NOT NULL DEFAULT 'MP4',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_export_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_export_profiles_workspaceId_projectId_idx" ON "video_export_profiles"("workspaceId", "projectId");

CREATE TABLE "video_render_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "profileId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'MP4',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "supportsAlpha" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputPath" TEXT,
    "editableBundlePath" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "video_render_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_render_jobs_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_render_jobs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "video_export_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "video_render_jobs_workspaceId_projectId_status_idx" ON "video_render_jobs"("workspaceId", "projectId", "status");

CREATE TABLE "video_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_versions_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "video_versions_videoProjectId_version_key" ON "video_versions"("videoProjectId", "version");

CREATE TABLE "video_quality_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "checksJson" TEXT NOT NULL DEFAULT '[]',
    "disclaimer" TEXT NOT NULL DEFAULT 'Automated video quality checks verify technical brand/format rules and do not guarantee campaign performance.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_quality_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_quality_reports_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "video_quality_reports_workspaceId_projectId_idx" ON "video_quality_reports"("workspaceId", "projectId");
