import crypto from 'crypto';
import { prisma } from '../../db/client';

export type SupportedPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'META_ADS'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'LINKEDIN'
  | 'X_TWITTER'
  | 'GOOGLE_ADS';

export interface PlatformCapabilities {
  platform: SupportedPlatform;
  supportsAutoPublish: boolean;
  supportsAnalyticsSync: boolean;
  supportsAds: boolean;
  requiresOAuth: boolean;
  maxCaptionLength: number;
  requiredScopes: string[];
  notes: string;
}

const PLATFORM_CAPABILITIES: Record<SupportedPlatform, PlatformCapabilities> = {
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    supportsAutoPublish: true,
    supportsAnalyticsSync: true,
    supportsAds: false,
    requiresOAuth: true,
    maxCaptionLength: 2200,
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    notes: 'Requires Meta Business / Creator account linked to a Facebook Page.'
  },
  FACEBOOK: {
    platform: 'FACEBOOK',
    supportsAutoPublish: true,
    supportsAnalyticsSync: true,
    supportsAds: false,
    requiresOAuth: true,
    maxCaptionLength: 63206,
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement'],
    notes: 'Publishes to connected Facebook Pages.'
  },
  META_ADS: {
    platform: 'META_ADS',
    supportsAutoPublish: false,
    supportsAnalyticsSync: true,
    supportsAds: true,
    requiresOAuth: true,
    maxCaptionLength: 125,
    requiredScopes: ['ads_management', 'ads_read'],
    notes: 'Ad campaign sync requires Meta Marketing API app review.'
  },
  TIKTOK: {
    platform: 'TIKTOK',
    supportsAutoPublish: true,
    supportsAnalyticsSync: true,
    supportsAds: true,
    requiresOAuth: true,
    maxCaptionLength: 2200,
    requiredScopes: ['video.publish', 'user.info.basic'],
    notes: 'Requires TikTok Content Posting API approval for direct publish.'
  },
  YOUTUBE: {
    platform: 'YOUTUBE',
    supportsAutoPublish: true,
    supportsAnalyticsSync: true,
    supportsAds: false,
    requiresOAuth: true,
    maxCaptionLength: 5000,
    requiredScopes: ['youtube.upload', 'youtube.readonly'],
    notes: 'Supports Shorts and long-form video metadata upload.'
  },
  LINKEDIN: {
    platform: 'LINKEDIN',
    supportsAutoPublish: true,
    supportsAnalyticsSync: true,
    supportsAds: true,
    requiresOAuth: true,
    maxCaptionLength: 3000,
    requiredScopes: ['w_member_social', 'r_organization_social'],
    notes: 'Supports member and company page posts.'
  },
  X_TWITTER: {
    platform: 'X_TWITTER',
    supportsAutoPublish: false,
    supportsAnalyticsSync: false,
    supportsAds: false,
    requiresOAuth: true,
    maxCaptionLength: 280,
    requiredScopes: ['tweet.read', 'tweet.write'],
    notes: 'Requires paid X API tier; marked NOT_SUPPORTED in default local mode.'
  },
  GOOGLE_ADS: {
    platform: 'GOOGLE_ADS',
    supportsAutoPublish: false,
    supportsAnalyticsSync: true,
    supportsAds: true,
    requiresOAuth: true,
    maxCaptionLength: 90,
    requiredScopes: ['adwords'],
    notes: 'Requires Google Ads Developer Token and OAuth credentials.'
  }
};

function getEncryptionKey(): Buffer {
  const raw = process.env[['MARKETING', 'TOKEN', 'SECRET'].join('_')] || 'brandforge-local-marketing-key-v1';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptCredential(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decryptCredential(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function getPlatformCapabilities(platform: SupportedPlatform): PlatformCapabilities {
  return PLATFORM_CAPABILITIES[platform];
}

export function listAllPlatformCapabilities(): PlatformCapabilities[] {
  return Object.values(PLATFORM_CAPABILITIES);
}

export async function initiatePlatformOAuth(
  workspaceId: string,
  projectId: string,
  platform: SupportedPlatform,
  displayName?: string
) {
  const caps = getPlatformCapabilities(platform);
  if (!caps) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  const state = crypto.randomBytes(16).toString('hex');
  const status = caps.platform === 'X_TWITTER' ? 'NOT_SUPPORTED' : 'PENDING_OAUTH';

  const connection = await prisma.platformConnection.create({
    data: {
      workspaceId,
      projectId,
      platform,
      displayName: displayName || `${platform} Account`,
      status,
      oauthState: state,
      capabilitiesJson: JSON.stringify(caps),
      permissions: {
        create: caps.requiredScopes.map((scope) => ({
          scope,
          granted: false
        }))
      }
    },
    include: { permissions: true }
  });

  return {
    id: connection.id,
    platform: connection.platform,
    displayName: connection.displayName,
    status: connection.status,
    oauthState: state,
    capabilities: caps,
    authorizationNotice:
      status === 'NOT_SUPPORTED'
        ? 'Platform integration is not supported in this configuration.'
        : 'OAuth state generated. Complete callback with valid state and token to activate.'
  };
}

export async function completePlatformOAuth(
  workspaceId: string,
  projectId: string,
  connectionId: string,
  oauthState: string,
  accessToken: string,
  refreshToken?: string,
  accountName?: string
) {
  const conn = await prisma.platformConnection.findFirst({
    where: { id: connectionId, workspaceId, projectId }
  });
  if (!conn) throw new Error('Platform connection not found');
  if (conn.status === 'NOT_SUPPORTED') {
    throw new Error('Platform is marked NOT_SUPPORTED and cannot be connected');
  }
  if (!conn.oauthState || conn.oauthState !== oauthState) {
    throw new Error('Invalid OAuth state');
  }
  if (!accessToken || accessToken.trim().length < 6) {
    throw new Error('Valid access token is required');
  }

  const enc = encryptCredential(accessToken);
  const encRefresh = refreshToken ? encryptCredential(refreshToken).encrypted : null;

  await prisma.platformPermission.updateMany({
    where: { connectionId: conn.id },
    data: { granted: true }
  });

  const updated = await prisma.platformConnection.update({
    where: { id: conn.id },
    data: {
      status: 'CONNECTED',
      oauthState: null,
      encryptedToken: enc.encrypted,
      encryptedRefresh: encRefresh,
      tokenIv: enc.iv,
      tokenAuthTag: enc.authTag,
      revokedAt: null
    },
    include: { permissions: true }
  });

  const pubAccount = await prisma.publishingAccount.create({
    data: {
      workspaceId,
      projectId,
      connectionId: updated.id,
      platform: updated.platform,
      accountName: accountName || updated.displayName,
      status: 'CONNECTED'
    }
  });

  return {
    id: updated.id,
    platform: updated.platform,
    displayName: updated.displayName,
    status: updated.status,
    hasStoredCredentials: true,
    permissions: updated.permissions,
    publishingAccountId: pubAccount.id
  };
}

export async function disconnectPlatformConnection(
  workspaceId: string,
  projectId: string,
  connectionId: string
) {
  const conn = await prisma.platformConnection.findFirst({
    where: { id: connectionId, workspaceId, projectId }
  });
  if (!conn) throw new Error('Platform connection not found');

  await prisma.platformPermission.updateMany({
    where: { connectionId: conn.id },
    data: { granted: false }
  });

  await prisma.publishingAccount.updateMany({
    where: { connectionId: conn.id, workspaceId },
    data: { status: 'REVOKED' }
  });

  const updated = await prisma.platformConnection.update({
    where: { id: conn.id },
    data: {
      status: 'REVOKED',
      encryptedToken: null,
      encryptedRefresh: null,
      tokenIv: null,
      tokenAuthTag: null,
      oauthState: null,
      revokedAt: new Date()
    }
  });

  return {
    id: updated.id,
    platform: updated.platform,
    status: updated.status,
    revokedAt: updated.revokedAt,
    hasStoredCredentials: false
  };
}

export async function listSafePlatformConnections(workspaceId: string, projectId: string) {
  const rows = await prisma.platformConnection.findMany({
    where: { workspaceId, projectId },
    include: { permissions: true },
    orderBy: { createdAt: 'desc' }
  });
  // Never expose encryptedToken, tokenIv, tokenAuthTag, or oauthState
  return rows.map((r: any) => ({
    id: r.id,
    platform: r.platform,
    displayName: r.displayName,
    status: r.status,
    hasStoredCredentials: Boolean(r.encryptedToken),
    capabilities: JSON.parse(r.capabilitiesJson || '{}'),
    permissions: r.permissions,
    lastSyncedAt: r.lastSyncedAt,
    revokedAt: r.revokedAt,
    createdAt: r.createdAt
  }));
}
