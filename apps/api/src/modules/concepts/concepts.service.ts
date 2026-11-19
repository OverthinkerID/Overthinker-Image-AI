import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { OpenAiCloudAdapter } from '../ai/cloud.adapter';
import { ComfyUiService } from '../ai/comfyui.service';
import { buildCategoryPrompt, CONCEPT_CATEGORIES, type BrandDnaPromptContext, type ConceptCategoryKey } from './prompt.engine';

const storage = new LocalStorageService(env.storageRoot);
const comfy = new ComfyUiService();
const openAi = new OpenAiCloudAdapter();

function safeJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
}

function buildCategoryStyleTokens(categoryKey: ConceptCategoryKey, dnaColors: Array<{ role: string; hex: string }>, headingFont: string, bodyFont: string) {
  const primary = dnaColors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
  const secondary = dnaColors.find((c) => c.role === 'SECONDARY')?.hex || '#1E293B';
  const accent = dnaColors.find((c) => c.role === 'ACCENT')?.hex || '#38BDF8';
  switch (categoryKey) {
    case 'ORIGINAL_EVOLUTION':
      return { description: 'Refines the existing brand identity with stronger grid discipline and cohesive touchpoints while preserving the original logo.', visualDirection: 'Balanced heritage evolution with crisp spacing.', palette: [primary, secondary, accent, '#F8FAFC', '#0F172A'], typography: { headingFont, bodyFont, scale: '1.25 Major Third' }, logoApplicationDirection: 'Use untouched original master logo centered with 20% clear-space padding.', graphicElements: ['Modular 8px Grid', 'Hairline Dividers'], moodboard: { keywords: ['Refined', 'Trustworthy', 'Cohesive'], surface: 'Matte Paper & Crisp UI' } };
    case 'PREMIUM_LUXURY':
      return { description: 'Elevates the brand into an editorial luxury tier using deep slate surfaces and warm metallic accents.', visualDirection: 'Editorial luxury minimalism with ceremonial whitespace.', palette: ['#0B0F19', '#D4AF37', primary, '#F5F3EF', '#1C2434'], typography: { headingFont: headingFont === 'Inter' ? 'Playfair Display' : headingFont, bodyFont, scale: '1.333 Perfect Fourth' }, logoApplicationDirection: 'Present original logo as a high-contrast focal emblem on deep obsidian or warm ivory.', graphicElements: ['Foil-Style Borders', 'Editorial Framing'], moodboard: { keywords: ['Timeless', 'Tactile', 'Prestigious'], surface: 'Textured Cotton & Brass' } };
    case 'MODERN_MINIMALIST':
      return { description: 'Distills the identity to Swiss-style geometric clarity and high-contrast functional focus.', visualDirection: 'Swiss modernist grid with razor-sharp hierarchy.', palette: ['#FFFFFF', '#0F172A', primary, '#E2E8F0', '#475569'], typography: { headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter', scale: '1.2 Minor Third' }, logoApplicationDirection: 'Lock original logo to grid intersections alongside crisp geometric type.', graphicElements: ['1px Structural Rules', 'Geometric Masking'], moodboard: { keywords: ['Clarity', 'Precision', 'Functional'], surface: 'Uncoated Stock & Flat UI' } };
    case 'CREATIVE_FUTURISTIC':
      return { description: 'Explores a forward-looking spatial aesthetic with dynamic gradients and expressive digital-native energy.', visualDirection: 'Kinetic futuristic identity with luminous depth.', palette: [primary, accent, '#7C3AED', '#090D16', '#EC4899'], typography: { headingFont: 'Space Grotesk', bodyFont: 'DM Sans', scale: '1.25 Major Third' }, logoApplicationDirection: 'Display original logo over subtle glassmorphic cards without altering mark geometry.', graphicElements: ['Mesh Gradients', 'Glassmorphic Surfaces'], moodboard: { keywords: ['Kinetic', 'Visionary', 'Expressive'], surface: 'Luminous Glass' } };
  }
}

function renderConceptPreviewSvg(params: { brandName: string; conceptName: string; palette: string[]; headingFont: string; bodyFont: string; keywords: string[] }): string {
  const [c0, c1, c2, c3, c4] = [params.palette[0] || '#2563EB', params.palette[1] || '#1E293B', params.palette[2] || '#38BDF8', params.palette[3] || '#F8FAFC', params.palette[4] || '#0F172A'];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="${c4}"/><rect x="24" y="24" width="752" height="452" rx="16" fill="${c1}" stroke="${c2}" stroke-opacity="0.35"/>
  <text x="52" y="76" fill="${c2}" font-family="system-ui, sans-serif" font-size="13" font-weight="600">${esc(params.conceptName.toUpperCase())}</text>
  <text x="52" y="128" fill="${c3}" font-family="${esc(params.headingFont)}, sans-serif" font-size="38" font-weight="700">${esc(params.brandName)}</text>
  <text x="52" y="162" fill="${c3}" fill-opacity="0.75" font-family="${esc(params.bodyFont)}, sans-serif" font-size="15">Typography: ${esc(params.headingFont)} + ${esc(params.bodyFont)}</text>
  <g transform="translate(52, 205)">
    <rect x="0" y="0" width="120" height="72" rx="10" fill="${c0}"/><rect x="134" y="0" width="120" height="72" rx="10" fill="${c1}"/><rect x="268" y="0" width="120" height="72" rx="10" fill="${c2}"/><rect x="402" y="0" width="120" height="72" rx="10" fill="${c3}"/><rect x="536" y="0" width="120" height="72" rx="10" fill="${c4}"/>
  </g>
  <text x="52" y="340" fill="${c3}" font-family="system-ui, sans-serif" font-size="14">Keywords: ${esc(params.keywords.join(' · '))}</text>
</svg>`;
}

export class ConceptsService {
  private async getPromptContext(projectId: string, brandDnaId?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${projectId}" not found.`);
    const dna = brandDnaId
      ? await prisma.brandDna.findFirst({ where: { id: brandDnaId, projectId }, include: { colors: true, typography: true, personality: true } })
      : await prisma.brandDna.findFirst({ where: { projectId }, include: { colors: true, typography: true, personality: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] });
    if (!dna) throw new AppError(400, 'BRAND_DNA_REQUIRED', 'Run Logo Analyzer and build Brand DNA before generating concepts.');
    const ctx: BrandDnaPromptContext = {
      brandName: dna.brandName, industry: dna.industry || dna.personality?.industry || 'General',
      personalityTraits: safeJsonArray(dna.personality?.personalityTraitsJson), visualStyle: dna.personality?.visualStyle || 'Modern',
      visualDirection: dna.visualDirection || 'Clean contemporary brand identity', colors: dna.colors.map((c) => ({ role: c.role, hex: c.hex })),
      headingFont: dna.typography?.headingFont || 'Plus Jakarta Sans', bodyFont: dna.typography?.bodyFont || 'Inter',
      targetAudience: dna.personality?.targetAudience || 'Modern consumers', designRules: safeJsonArray(dna.designRulesJson),
    };
    return { project, dna, ctx };
  }

  private async generateVisualPreview(params: { projectId: string; conceptId: string; brandName: string; conceptName: string; palette: string[]; headingFont: string; bodyFont: string; keywords: string[]; prompt: string; negativePrompt: string; provider: string; model?: string; workflowId?: string; parameters?: Record<string, unknown> }) {
    const previews: Array<{ kind: string; storagePath: string; mimeType: string }> = [];
    let usedModel = params.model || 'svg-concept-renderer-v1';
    const svg = renderConceptPreviewSvg(params);
    const svgSaved = await storage.saveConceptAsset({ projectId: params.projectId, conceptId: params.conceptId, filename: `moodboard-v${Date.now()}.svg`, buffer: Buffer.from(svg, 'utf8') });
    previews.push({ kind: 'moodboard-svg', storagePath: svgSaved.storagePath, mimeType: 'image/svg+xml' });

    if (params.provider === 'comfyui') {
      const wf = params.workflowId ? await prisma.comfyWorkflowTemplate.findUnique({ where: { id: params.workflowId } }) : await prisma.comfyWorkflowTemplate.findFirst({ where: { isDefault: true } });
      if (wf) {
        const res = await comfy.submitAndWaitForImage({ workflowTemplateJson: wf.workflowJson, workflowParams: { prompt: params.prompt, negativePrompt: params.negativePrompt, model: params.model, steps: Number(params.parameters?.steps || 24), cfg: Number(params.parameters?.cfg || 7.0), width: Number(params.parameters?.width || 1024), height: Number(params.parameters?.height || 1024) }, maxRetries: 1 });
        const pngSaved = await storage.saveConceptAsset({ projectId: params.projectId, conceptId: params.conceptId, filename: `comfy-${res.promptId.slice(0, 8)}.png`, buffer: res.buffer });
        previews.unshift({ kind: 'comfyui-render', storagePath: pngSaved.storagePath, mimeType: res.mimeType });
        usedModel = params.model || env.ai.comfyUiDefaultModel;
      }
    } else if (params.provider === 'cloud-openai' && openAi.isConfigured()) {
      const img = await openAi.generateImage({ prompt: params.prompt, width: 1024, height: 1024, model: params.model });
      const pngSaved = await storage.saveConceptAsset({ projectId: params.projectId, conceptId: params.conceptId, filename: `openai-${Date.now()}.png`, buffer: img.buffer });
      previews.unshift({ kind: 'cloud-openai-render', storagePath: pngSaved.storagePath, mimeType: img.mimeType });
      usedModel = img.model;
    }
    return { previews, usedModel };
  }

  async generateFourConcepts(projectId: string, opts: { brandDnaId?: string; provider?: string; model?: string; workflowId?: string; parameters?: Record<string, unknown> }) {
    const { dna, ctx } = await this.getPromptContext(projectId, opts.brandDnaId);
    const provider = opts.provider || 'heuristic';
    const job = await prisma.aiJob.create({ data: { projectId, brandDnaId: dna.id, jobType: 'CONCEPT_BATCH', status: 'PROCESSING', progress: 10, provider, model: opts.model || null, prompt: `Batch generation of 4 Brand Concepts for ${ctx.brandName} (DNA v${dna.version})`, workflowId: opts.workflowId || null, parametersJson: JSON.stringify(opts.parameters || {}), startedAt: new Date() } });
    try {
      const createdConcepts = [];
      const outputRefs: string[] = [];
      for (let i = 0; i < CONCEPT_CATEGORIES.length; i++) {
        const categoryKey = CONCEPT_CATEGORIES[i];
        const promptSpec = buildCategoryPrompt(ctx, categoryKey);
        const tokens = buildCategoryStyleTokens(categoryKey, ctx.colors, ctx.headingFont, ctx.bodyFont);
        const conceptId = `concept_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        let previews: Array<{ kind: string; storagePath: string; mimeType: string }> = [];
        try {
          previews = (await this.generateVisualPreview({ projectId, conceptId, brandName: ctx.brandName, conceptName: promptSpec.conceptName, palette: tokens.palette, headingFont: tokens.typography.headingFont, bodyFont: tokens.typography.bodyFont, keywords: tokens.moodboard.keywords, prompt: promptSpec.prompt, negativePrompt: promptSpec.negativePrompt, provider, model: opts.model, workflowId: opts.workflowId, parameters: opts.parameters })).previews;
        } catch (err) {
          if (provider !== 'heuristic') previews = (await this.generateVisualPreview({ projectId, conceptId, brandName: ctx.brandName, conceptName: promptSpec.conceptName, palette: tokens.palette, headingFont: tokens.typography.headingFont, bodyFont: tokens.typography.bodyFont, keywords: tokens.moodboard.keywords, prompt: promptSpec.prompt, negativePrompt: promptSpec.negativePrompt, provider: 'heuristic' })).previews;
          else throw err;
        }
        outputRefs.push(...previews.map((p) => p.storagePath));
        const concept = await prisma.brandConcept.create({
          data: {
            id: conceptId, projectId, brandDnaId: dna.id, categoryKey, conceptName: promptSpec.conceptName,
            description: tokens.description, visualDirection: tokens.visualDirection, moodboardJson: JSON.stringify(tokens.moodboard),
            colorPaletteJson: JSON.stringify(tokens.palette), typographyJson: JSON.stringify(tokens.typography),
            logoApplicationDirection: tokens.logoApplicationDirection, graphicElementsJson: JSON.stringify(tokens.graphicElements),
            mockupPreviewsJson: JSON.stringify(previews), promptUsed: promptSpec.prompt, currentVersion: 1,
            revisions: { create: { version: 1, conceptName: promptSpec.conceptName, description: tokens.description, visualDirection: tokens.visualDirection, colorPaletteJson: JSON.stringify(tokens.palette), typographyJson: JSON.stringify(tokens.typography), mockupPreviewsJson: JSON.stringify(previews), revisionNote: 'Initial concept generation', promptUsed: promptSpec.prompt } },
          },
          include: { revisions: { orderBy: { version: 'desc' } } },
        });
        createdConcepts.push(concept);
        await prisma.aiJob.update({ where: { id: job.id }, data: { progress: Math.round(((i + 1) / CONCEPT_CATEGORIES.length) * 100) } });
      }
      const completedJob = await prisma.aiJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', progress: 100, outputRefsJson: JSON.stringify(outputRefs), completedAt: new Date() } });
      return { concepts: createdConcepts, job: completedJob };
    } catch (err) {
      await prisma.aiJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Concept generation failed', completedAt: new Date() } });
      throw err;
    }
  }

  async listConcepts(projectId: string) {
    return prisma.brandConcept.findMany({ where: { projectId }, include: { revisions: { orderBy: { version: 'desc' } } }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] });
  }

  async regenerateConcept(projectId: string, conceptId: string, opts: { provider?: string; model?: string; revisionNote?: string; customPrompt?: string }) {
    const existing = await prisma.brandConcept.findFirst({ where: { id: conceptId, projectId } });
    if (!existing) throw new AppError(404, 'CONCEPT_NOT_FOUND', `Concept "${conceptId}" not found.`);
    if (existing.isLocked) throw new AppError(409, 'CONCEPT_LOCKED', 'Approved concept is locked. Create a controlled revision or unlock before regenerating.');
    const { ctx } = await this.getPromptContext(projectId, existing.brandDnaId);
    const categoryKey = existing.categoryKey as ConceptCategoryKey;
    const promptSpec = buildCategoryPrompt(ctx, categoryKey);
    const finalPrompt = opts.customPrompt?.trim() || promptSpec.prompt;
    const tokens = buildCategoryStyleTokens(categoryKey, ctx.colors, ctx.headingFont, ctx.bodyFont);
    const nextVersion = existing.currentVersion + 1;
    const provider = opts.provider || 'heuristic';
    const job = await prisma.aiJob.create({ data: { projectId, brandDnaId: existing.brandDnaId, conceptId: existing.id, jobType: 'CONCEPT_REGENERATE', status: 'PROCESSING', progress: 25, provider, model: opts.model || null, prompt: finalPrompt, startedAt: new Date() } });
    try {
      const rendered = await this.generateVisualPreview({ projectId, conceptId: existing.id, brandName: ctx.brandName, conceptName: existing.conceptName, palette: tokens.palette, headingFont: tokens.typography.headingFont, bodyFont: tokens.typography.bodyFont, keywords: tokens.moodboard.keywords, prompt: finalPrompt, negativePrompt: promptSpec.negativePrompt, provider, model: opts.model });
      const updated = await prisma.brandConcept.update({
        where: { id: existing.id },
        data: {
          currentVersion: nextVersion, promptUsed: finalPrompt, mockupPreviewsJson: JSON.stringify(rendered.previews),
          revisions: { create: { version: nextVersion, conceptName: existing.conceptName, description: existing.description, visualDirection: existing.visualDirection, colorPaletteJson: existing.colorPaletteJson, typographyJson: existing.typographyJson, mockupPreviewsJson: JSON.stringify(rendered.previews), revisionNote: opts.revisionNote || `Regenerated v${nextVersion}`, promptUsed: finalPrompt } },
        },
        include: { revisions: { orderBy: { version: 'desc' } } },
      });
      await prisma.aiJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', progress: 100, model: rendered.usedModel, outputRefsJson: JSON.stringify(rendered.previews.map((p) => p.storagePath)), completedAt: new Date() } });
      return updated;
    } catch (err) {
      await prisma.aiJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Regeneration failed', completedAt: new Date() } });
      throw err;
    }
  }

  async toggleFavorite(projectId: string, conceptId: string) {
    const existing = await prisma.brandConcept.findFirst({ where: { id: conceptId, projectId } });
    if (!existing) throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found.');
    return prisma.brandConcept.update({ where: { id: conceptId }, data: { isFavorite: !existing.isFavorite }, include: { revisions: { orderBy: { version: 'desc' } } } });
  }

  async approveAndLockConcept(projectId: string, conceptId: string) {
    const existing = await prisma.brandConcept.findFirst({ where: { id: conceptId, projectId } });
    if (!existing) throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found.');
    return prisma.$transaction(async (tx) => {
      await tx.brandConcept.updateMany({ where: { projectId, isPrimary: true, NOT: { id: conceptId } }, data: { isPrimary: false } });
      return tx.brandConcept.update({ where: { id: conceptId }, data: { isPrimary: true, isApproved: true, isLocked: true, approvedAt: new Date() }, include: { revisions: { orderBy: { version: 'desc' } } } });
    });
  }

  async createControlledRevision(projectId: string, conceptId: string, payload: { conceptName?: string; description?: string; visualDirection?: string; revisionNote?: string }) {
    const existing = await prisma.brandConcept.findFirst({ where: { id: conceptId, projectId } });
    if (!existing) throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found.');
    const nextVersion = existing.currentVersion + 1;
    const conceptName = payload.conceptName?.trim() || existing.conceptName;
    const description = payload.description?.trim() || existing.description;
    const visualDirection = payload.visualDirection?.trim() || existing.visualDirection;
    return prisma.brandConcept.update({
      where: { id: conceptId },
      data: {
        conceptName, description, visualDirection, currentVersion: nextVersion,
        revisions: { create: { version: nextVersion, conceptName, description, visualDirection, colorPaletteJson: existing.colorPaletteJson, typographyJson: existing.typographyJson, mockupPreviewsJson: existing.mockupPreviewsJson, revisionNote: payload.revisionNote || `Controlled revision v${nextVersion}`, promptUsed: existing.promptUsed } },
      },
      include: { revisions: { orderBy: { version: 'desc' } } },
    });
  }

  async listAiJobs(projectId: string) { return prisma.aiJob.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async cancelAiJob(projectId: string, jobId: string) {
    const job = await prisma.aiJob.findFirst({ where: { id: jobId, projectId } });
    if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'AI Job not found.');
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) return job;
    return prisma.aiJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', completedAt: new Date() } });
  }
  async readConceptPreviewAsset(projectId: string, conceptId: string, filename: string) {
    const buffer = await storage.readConceptAsset(`projects/${projectId}/concepts/${conceptId}/${filename}`);
    const mimeType = filename.endsWith('.svg') ? 'image/svg+xml' : filename.endsWith('.webp') ? 'image/webp' : 'image/png';
    return { buffer, mimeType };
  }
}
