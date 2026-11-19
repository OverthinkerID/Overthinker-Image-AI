import sharp from 'sharp';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { OpenAiCloudAdapter } from '../ai/cloud.adapter';
import { ComfyUiService } from '../ai/comfyui.service';

const storage = new LocalStorageService(env.storageRoot);
const comfy = new ComfyUiService();
const openAi = new OpenAiCloudAdapter();

export interface MockupSceneConfig {
  logoAssetId?: string | null; logoX: number; logoY: number; logoScale: number; logoRotation: number;
  objectColor: string; backgroundColor: string; backgroundImagePath?: string | null; headlineText: string; subtext: string; skewDeg?: number;
}

function escXml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function renderMockupSceneSvg(params: { width: number; height: number; templateName: string; category: string; brandName: string; scene: MockupSceneConfig; embeddedLogoSvg?: string | null }): string {
  const { width, height, scene } = params;
  const skew = scene.skewDeg ? ` skewX(${scene.skewDeg})` : '';
  const logoTransform = `translate(${scene.logoX}, ${scene.logoY}) rotate(${scene.logoRotation}) scale(${scene.logoScale})${skew}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${escXml(scene.backgroundColor)}"/>
  <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.14)}" width="${Math.round(width * 0.76)}" height="${Math.round(height * 0.72)}" rx="24" fill="${escXml(scene.objectColor)}" stroke="#CBD5E1" stroke-opacity="0.35" stroke-width="2"/>
  <text x="${Math.round(width * 0.16)}" y="${Math.round(height * 0.21)}" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="14" font-weight="600">${escXml(params.category)} · ${escXml(params.templateName.toUpperCase())}</text>
  <g transform="${logoTransform}">${params.embeddedLogoSvg || `<rect x="-80" y="-40" width="160" height="80" rx="14" fill="#2563EB"/><text x="0" y="10" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escXml(params.brandName)}</text>`}</g>
  <text x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.76)}" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="26" font-weight="700">${escXml(scene.headlineText)}</text>
  <text x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.81)}" text-anchor="middle" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="15">${escXml(scene.subtext)}</text>
</svg>`;
}

export class SmartMockupService {
  async createMockupFromTemplate(projectId: string, payload: { templateId: string; title?: string; width?: number; height?: number; sourceAssetId?: string; conceptId?: string }) {
    const [project, template] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { colors: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] }, brandAssets: { where: { category: 'LOGO_VARIATION' }, take: 1 } } }),
      prisma.mockupTemplate.findUnique({ where: { id: payload.templateId } }),
    ]);
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    if (!template) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Mockup template not found.');
    const dna = project.brandDnas[0] || null;
    const concept = payload.conceptId ? project.concepts.find((c) => c.id === payload.conceptId) || project.concepts[0] : project.concepts[0] || null;
    const placement = JSON.parse(template.placementJson || '{}') as { x?: number; y?: number; skewDeg?: number };
    const scene: MockupSceneConfig = {
      logoAssetId: payload.sourceAssetId || project.brandAssets[0]?.id || null,
      logoX: placement.x || 600, logoY: placement.y || 380, logoScale: 1, logoRotation: 0,
      objectColor: dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#1E293B', backgroundColor: '#0F172A',
      headlineText: dna?.brandName || project.name, subtext: project.description || template.name, skewDeg: placement.skewDeg,
    };
    const width = payload.width || template.width, height = payload.height || template.height;
    const svg = renderMockupSceneSvg({ width, height, templateName: template.name, category: template.category, brandName: dna?.brandName || project.name, scene });
    const pngBuf = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'mockups', filename: `mockup-${Date.now()}.png`, buffer: pngBuf });
    return prisma.mockupDocument.create({
      data: { projectId, templateId: template.id, conceptId: concept?.id || null, sourceAssetId: scene.logoAssetId, title: payload.title || `${project.name} — ${template.name}`, category: template.category, width, height, sceneConfigJson: JSON.stringify(scene), renderedPath: saved.storagePath, currentVersion: 1, versions: { create: { version: 1, sceneConfigJson: JSON.stringify(scene), renderedPath: saved.storagePath, changeNote: 'Initial mockup render' } } },
      include: { template: true, versions: { orderBy: { version: 'desc' } } },
    });
  }

  async listMockups(projectId: string) {
    return prisma.mockupDocument.findMany({ where: { projectId }, include: { template: true, versions: { orderBy: { version: 'desc' } } }, orderBy: { updatedAt: 'desc' } });
  }

  async updateAndRenderMockup(projectId: string, mockupId: string, payload: { scene: Partial<MockupSceneConfig>; changeNote?: string }) {
    const existing = await prisma.mockupDocument.findFirst({ where: { id: mockupId, projectId }, include: { template: true, project: true } });
    if (!existing) throw new AppError(404, 'MOCKUP_NOT_FOUND', 'Mockup document not found.');
    const caps = JSON.parse(existing.template?.capabilitiesJson || '{}') as Record<string, boolean>;
    const currentScene = JSON.parse(existing.sceneConfigJson || '{}') as MockupSceneConfig;
    const nextScene: MockupSceneConfig = {
      ...currentScene,
      ...(payload.scene.logoAssetId !== undefined ? { logoAssetId: payload.scene.logoAssetId } : {}),
      ...(payload.scene.logoX !== undefined ? { logoX: payload.scene.logoX } : {}),
      ...(payload.scene.logoY !== undefined ? { logoY: payload.scene.logoY } : {}),
      ...(payload.scene.logoScale !== undefined ? { logoScale: payload.scene.logoScale } : {}),
      ...(payload.scene.logoRotation !== undefined ? { logoRotation: payload.scene.logoRotation } : {}),
      ...(payload.scene.objectColor && caps.supportsColorChange !== false ? { objectColor: payload.scene.objectColor } : {}),
      ...(payload.scene.backgroundColor && caps.supportsBgChange !== false ? { backgroundColor: payload.scene.backgroundColor } : {}),
      ...(payload.scene.headlineText !== undefined && caps.supportsTextReplace !== false ? { headlineText: payload.scene.headlineText } : {}),
      ...(payload.scene.subtext !== undefined && caps.supportsTextReplace !== false ? { subtext: payload.scene.subtext } : {}),
    };
    const nextVersion = existing.currentVersion + 1;
    const svg = renderMockupSceneSvg({ width: existing.width, height: existing.height, templateName: existing.template?.name || existing.title, category: existing.category, brandName: existing.project.name, scene: nextScene });
    const pngBuf = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'mockups', filename: `mockup-${existing.id}-v${nextVersion}.png`, buffer: pngBuf });
    return prisma.mockupDocument.update({
      where: { id: existing.id },
      data: { sourceAssetId: nextScene.logoAssetId || existing.sourceAssetId, sceneConfigJson: JSON.stringify(nextScene), renderedPath: saved.storagePath, currentVersion: nextVersion, versions: { create: { version: nextVersion, sceneConfigJson: JSON.stringify(nextScene), renderedPath: saved.storagePath, changeNote: payload.changeNote || `Updated mockup v${nextVersion}` } } },
      include: { template: true, versions: { orderBy: { version: 'desc' } } },
    });
  }

  async generateAiMockupScene(projectId: string, payload: { mockupId?: string; category: string; provider?: string; instructions?: string; logoAssetId?: string }) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { colors: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] } } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0], concept = project.concepts[0], provider = payload.provider || 'heuristic';
    const primaryHex = dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
    const prompt = `Photorealistic ${payload.category} mockup background environment for "${dna?.brandName || project.name}", ${concept?.visualDirection || 'modern brand studio lighting'}, accent palette ${primaryHex}. ${payload.instructions || ''}`.trim();
    const job = await prisma.mockupRenderJob.create({ data: { projectId, mockupId: payload.mockupId || null, provider, prompt, sourceAssetRefs: JSON.stringify([payload.logoAssetId, concept?.id].filter(Boolean)), status: 'PROCESSING', progress: 25 } });
    try {
      let bgBuffer: Buffer | null = null;
      if (provider === 'comfyui') {
        const wf = await prisma.comfyWorkflowTemplate.findFirst({ where: { isDefault: true } });
        if (wf) bgBuffer = (await comfy.submitAndWaitForImage({ workflowTemplateJson: wf.workflowJson, workflowParams: { prompt, width: 1200, height: 900 }, maxRetries: 1 })).buffer;
      } else if (provider === 'cloud-openai' && openAi.isConfigured()) {
        bgBuffer = (await openAi.generateImage({ prompt, width: 1024, height: 1024 })).buffer;
      }
      if (!bgBuffer) {
        const svg = renderMockupSceneSvg({ width: 1200, height: 900, templateName: 'AI Studio Scene', category: payload.category, brandName: dna?.brandName || project.name, scene: { logoX: 600, logoY: 400, logoScale: 1.15, logoRotation: 0, objectColor: primaryHex, backgroundColor: '#090D16', headlineText: dna?.brandName || project.name, subtext: payload.instructions || `${payload.category} Brand Showcase` } });
        bgBuffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
      }
      const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'mockups', filename: `ai-mockup-${Date.now()}.png`, buffer: bgBuffer });
      return prisma.mockupRenderJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', progress: 100, outputPath: saved.storagePath, completedAt: new Date() } });
    } catch (err) {
      await prisma.mockupRenderJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'AI mockup render failed', completedAt: new Date() } });
      throw err;
    }
  }

  async readMockupRender(projectId: string, mockupId: string) {
    const mockup = await prisma.mockupDocument.findFirst({ where: { id: mockupId, projectId } });
    if (!mockup || !mockup.renderedPath) throw new AppError(404, 'MOCKUP_NOT_FOUND', 'Mockup render not found.');
    return storage.readRelativeFile(mockup.renderedPath);
  }
}
