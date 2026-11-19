import sharp from 'sharp';
import { env } from '../../config/appConfig';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { analyzeLogoBuffer } from '../analyzer/logo.analyzer';
import { computeWcagContrast } from '../design-engine/colorSystem.service';
import { DirectorAiAdapter } from './directorAi.adapter';
import {
  clampScore,
  computeOverallAdvisoryScore,
  DEFAULT_SCORING_CRITERIA,
  type EvidenceInput,
  type ScoringCategoryInput,
} from './scoring.engine';

const storage = new LocalStorageService(env.storageRoot);
const aiAdapter = new DirectorAiAdapter();

export class CreativeDirectorService {
  async getProjectContext(workspaceId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        logos: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        brandDnas: { include: { colors: true, typography: true, personality: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] },
        concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }] },
        logoVariations: true,
        colorSystems: { where: { isActive: true }, take: 1 },
        typographySystems: { where: { isActive: true }, take: 1 },
        graphicElements: true,
        designDocuments: { orderBy: { updatedAt: 'desc' }, take: 10 },
        mockupDocuments: { orderBy: { updatedAt: 'desc' }, take: 10 },
        brandGuidelines: { include: { sections: { orderBy: { orderIndex: 'asc' } } }, orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in active workspace.');

    const approvedDna = project.brandDnas.find((d) => d.isApproved) || null;
    const latestDraftDna = project.brandDnas[0] || null;
    const approvedConcept = project.concepts.find((c) => c.isApproved) || null;
    const primaryConcept = project.concepts.find((c) => c.isPrimary) || project.concepts[0] || null;

    return {
      project,
      approvedDna,
      latestDraftDna,
      approvedConcept,
      primaryConcept,
      summary: {
        projectName: project.name,
        industry: project.industry || approvedDna?.industry || 'Unspecified',
        hasApprovedBrandDna: Boolean(approvedDna),
        activeDnaLabel: approvedDna
          ? `[APPROVED DECISION] Brand DNA v${approvedDna.version}`
          : latestDraftDna
          ? `[UNAPPROVED AI/DRAFT] Brand DNA v${latestDraftDna.version}`
          : 'No Brand DNA yet',
        activeConceptLabel: approvedConcept
          ? `[APPROVED DECISION] ${approvedConcept.conceptName}`
          : primaryConcept
          ? `[UNAPPROVED SUGGESTION] ${primaryConcept.conceptName}`
          : 'No concept selected',
        originalLogosCount: project.logos.length,
        variationsCount: project.logoVariations.length,
        documentsCount: project.designDocuments.length,
        mockupsCount: project.mockupDocuments.length,
        hasGuidelines: project.brandGuidelines.length > 0,
      },
    };
  }

  // MODULE 1: AI Creative Director Conversational Assistant
  async listSessions(workspaceId: string, projectId: string) {
    return prisma.creativeSession.findMany({
      where: { workspaceId, projectId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async sendMessage(
    workspaceId: string,
    projectId: string,
    userId: string,
    payload: { sessionId?: string; message: string; provider?: string; model?: string; allowCloudUpload?: boolean }
  ) {
    const ctx = await this.getProjectContext(workspaceId, projectId);
    let session = payload.sessionId
      ? await prisma.creativeSession.findFirst({ where: { id: payload.sessionId, workspaceId, projectId } })
      : null;

    if (!session) {
      session = await prisma.creativeSession.create({
        data: {
          workspaceId,
          projectId,
          userId,
          title: payload.message.slice(0, 60) || 'Creative Director Session',
          provider: payload.provider || 'heuristic',
          model: payload.model || null,
          memoryJson: JSON.stringify({ decisions: [], notes: [] }),
        },
      });
    }

    await prisma.creativeMessage.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content: payload.message,
        contextSnapshotJson: JSON.stringify(ctx.summary),
      },
    });

    const dna = ctx.approvedDna || ctx.latestDraftDna;
    const concept = ctx.approvedConcept || ctx.primaryConcept;
    const systemPrompt = [
      'You are an executive Brand Creative Director & Branding Consultant.',
      'CRITICAL: Explicitly distinguish [APPROVED DECISION] from [UNAPPROVED AI SUGGESTION] and [ORIGINAL SOURCE].',
      'Never present an unapproved AI suggestion as an approved brand decision.',
      `Project: ${ctx.project.name} (${ctx.summary.industry})`,
      `Brand DNA Status: ${ctx.summary.activeDnaLabel}`,
      `Concept Status: ${ctx.summary.activeConceptLabel}`,
      dna ? `Colors: ${dna.colors.map((c) => `${c.role}:${c.hex}`).join(', ')}` : 'Colors: None',
      dna?.typography ? `Typography: ${dna.typography.headingFont} / ${dna.typography.bodyFont}` : 'Typography: None',
    ].join('\n');

    const aiRes = await aiAdapter.reasonText({
      workspaceId,
      projectId,
      userId,
      provider: payload.provider,
      model: payload.model,
      systemPrompt,
      prompt: payload.message,
      allowCloudUpload: payload.allowCloudUpload,
      fallbackText: () => {
        const lines = [
          `Creative Director Review for **${ctx.project.name}**:`,
          `• **Brand DNA**: ${ctx.summary.activeDnaLabel}${dna?.visualDirection ? ` — ${dna.visualDirection}` : ''}`,
          `• **Concept Direction**: ${ctx.summary.activeConceptLabel}${concept ? ` — ${concept.visualDirection}` : ''}`,
          `• **Asset Footprint**: ${ctx.summary.originalLogosCount} [ORIGINAL SOURCE] logo(s), ${ctx.summary.variationsCount} variation(s), ${ctx.summary.documentsCount} design doc(s), ${ctx.summary.mockupsCount} mockup(s).`,
          '',
          `**Advisory Recommendation** (Unapproved Suggestion — requires your sign-off):`,
          `In response to "${payload.message.slice(0, 120)}", align all active templates and mockups with ${dna?.colors[0]?.hex || 'your primary brand color'} and verify WCAG contrast >= 4.5:1 before locking assets for commercial export.`,
        ];
        return lines.join('\n');
      },
    });

    const reply = await prisma.creativeMessage.create({
      data: {
        sessionId: session.id,
        role: 'DIRECTOR',
        content: aiRes.text,
        provider: aiRes.provider,
        model: aiRes.model,
        promptVersion: 'cd-chat-v1.0',
        contextSnapshotJson: JSON.stringify({ ...ctx.summary, fallbackUsed: aiRes.fallbackUsed, errorNote: aiRes.errorNote || null }),
      },
    });

    return { session, reply, contextSummary: ctx.summary };
  }

  // MODULE 2: Logo Intelligence
  async evaluateLogo(
    workspaceId: string,
    projectId: string,
    userId: string,
    payload: { logoId?: string; provider?: string; model?: string; allowCloudUpload?: boolean }
  ) {
    const ctx = await this.getProjectContext(workspaceId, projectId);
    const logo = payload.logoId
      ? ctx.project.logos.find((l) => l.id === payload.logoId)
      : ctx.project.logos.find((l) => l.isPrimary) || ctx.project.logos[0];
    if (!logo) throw new AppError(404, 'LOGO_NOT_FOUND', 'No uploaded logo found in this project.');

    const buffer = await storage.readLogo(logo.storagePath);
    const analysis = await analyzeLogoBuffer(buffer, logo.mimeType);
    const isSvg = logo.mimeType === 'image/svg+xml';

    // Deterministic measurements
    const scalabilityScore = isSvg ? 96 : analysis.width >= 512 && analysis.height >= 512 ? 78 : analysis.width >= 200 ? 60 : 38;
    const reproductionScore = isSvg ? 95 : analysis.hasTransparency ? 84 : 68;
    const versatilityScore = analysis.isMonochrome ? 88 : analysis.hasTransparency ? 82 : 66;
    const readabilityScore = analysis.width >= 150 && analysis.colorCount <= 5 ? 84 : 68;
    const primaryHex = analysis.extractedColors[0]?.hex || '#0F172A';
    const lightContrast = computeWcagContrast(primaryHex, '#FFFFFF').ratio;
    const darkContrast = computeWcagContrast(primaryHex, '#0B1120').ratio;
    const balanceScore = analysis.aspectLabel === 'square' ? 86 : 78;

    const categories: ScoringCategoryInput[] = [
      { categoryKey: 'scalability', label: 'Scalability', score: scalabilityScore, judgmentType: 'DETERMINISTIC', explanation: isSvg ? 'Vector SVG scales infinitely without pixelation.' : `Raster ${analysis.width}x${analysis.height}px (${analysis.format}) has finite resolution.`, confidence: 0.95, severity: scalabilityScore < 55 ? 'CRITICAL' : scalabilityScore < 75 ? 'MINOR' : 'INFO', recommendation: isSvg ? 'Maintain clean viewBox.' : 'Provide a master vector SVG alongside raster exports.' },
      { categoryKey: 'reproduction_quality', label: 'Reproduction Quality', score: reproductionScore, judgmentType: 'DETERMINISTIC', explanation: `Format ${analysis.format}, transparency=${analysis.hasTransparency}, background=${analysis.backgroundType}.`, confidence: 0.92, severity: reproductionScore < 70 ? 'MAJOR' : 'INFO', recommendation: analysis.hasTransparency ? 'Ready for multi-surface placement.' : 'Create a transparent-background master variation.' },
      { categoryKey: 'versatility', label: 'Versatility (Light & Dark)', score: versatilityScore, judgmentType: 'DETERMINISTIC', explanation: `Light bg contrast ${lightContrast}:1, Dark bg contrast ${darkContrast}:1.`, confidence: 0.9, severity: Math.max(lightContrast, darkContrast) < 4.5 ? 'MAJOR' : 'INFO', recommendation: 'Use reversed/white and black monochrome variations for opposing backgrounds.' },
      { categoryKey: 'readability', label: 'Readability & Small-Size Legibility', score: readabilityScore, judgmentType: 'DETERMINISTIC', explanation: `Color count: ${analysis.colorCount}; shape style: ${analysis.shapeStyle}.`, confidence: 0.82, severity: analysis.colorCount > 5 ? 'MINOR' : 'INFO', recommendation: 'Test mark legibility at 32px favicon and 25mm print width.' },
      { categoryKey: 'visual_balance', label: 'Visual Balance & Proportions', score: balanceScore, judgmentType: 'DETERMINISTIC', explanation: `Aspect ratio ${analysis.aspectRatio} (${analysis.aspectLabel}).`, confidence: 0.85, severity: 'INFO', recommendation: 'Keep 20% clear space padding around the mark.' },
      { categoryKey: 'recognition', label: 'Recognition', score: 78, judgmentType: 'AI_SUBJECTIVE', explanation: `Distinct ${analysis.shapeStyle} silhouette.`, confidence: 0.68, severity: 'INFO', recommendation: 'Reinforce mark recognition with consistent color anchors.' },
      { categoryKey: 'memorability', label: 'Memorability', score: 76, judgmentType: 'AI_SUBJECTIVE', explanation: 'Advisory creative judgment based on geometric simplicity.', confidence: 0.65, severity: 'INFO', recommendation: 'Avoid adding decorative clutter in small-scale lockups.' },
      { categoryKey: 'distinctiveness', label: 'Distinctiveness', score: 75, judgmentType: 'AI_SUBJECTIVE', explanation: 'Advisory visual evaluation only; does not verify trademark uniqueness.', confidence: 0.6, severity: 'INFO', recommendation: 'Conduct a formal legal trademark search before commercial registration.' },
      { categoryKey: 'brand_alignment', label: 'Brand Alignment', score: ctx.approvedDna ? 85 : 70, judgmentType: 'AI_SUBJECTIVE', explanation: ctx.approvedDna ? `Aligned with approved Brand DNA v${ctx.approvedDna.version}.` : 'Brand DNA is not yet approved.', confidence: 0.78, severity: ctx.approvedDna ? 'INFO' : 'MINOR', recommendation: ctx.approvedDna ? 'Maintain current alignment.' : 'Approve Brand DNA to anchor downstream evaluations.' },
    ];

    const evidence: EvidenceInput[] = [
      { categoryKey: 'scalability', sourceType: 'IMAGE_PROCESSING', assetId: logo.id, assetVersion: 1, measurement: { width: analysis.width, height: analysis.height, format: analysis.format, aspectRatio: analysis.aspectRatio }, finding: `Measured ${analysis.width}x${analysis.height} ${analysis.format} mark.` },
      { categoryKey: 'versatility', sourceType: 'IMAGE_PROCESSING', assetId: logo.id, assetVersion: 1, measurement: { lightContrast, darkContrast, hasTransparency: analysis.hasTransparency, backgroundType: analysis.backgroundType }, finding: `Light contrast ${lightContrast}:1, Dark contrast ${darkContrast}:1.` },
    ];

    let visionNote = '';
    if (payload.provider && payload.provider !== 'heuristic') {
      const rasterForVision = isSvg ? await sharp(buffer).png().toBuffer() : buffer;
      const vRes = await aiAdapter.analyzeVision({
        workspaceId, projectId, userId, provider: payload.provider, model: payload.model,
        prompt: 'Critique this logo mark on scalability, negative space, small-size legibility, and visual balance. Do not claim trademark uniqueness.',
        imageBuffer: rasterForVision, mimeType: isSvg ? 'image/png' : logo.mimeType, allowCloudUpload: payload.allowCloudUpload,
        fallbackSummary: () => 'Deterministic Sharp inspection completed.',
      });
      visionNote = vRes.text;
      evidence.push({ categoryKey: 'recognition', sourceType: 'VISION_AI', assetId: logo.id, measurement: { provider: vRes.provider, model: vRes.model }, finding: visionNote.slice(0, 300) });
    }

    const overallScore = computeOverallAdvisoryScore(categories, evidence);
    const assessment = await prisma.creativeAssessment.create({
      data: {
        workspaceId, projectId, userId, assessmentType: 'LOGO_INTELLIGENCE', targetType: 'LOGO', targetId: logo.id,
        overallScore, isAdvisory: true, provider: payload.provider || 'heuristic', model: payload.model || 'sharp-deterministic-v1',
        promptVersion: 'cd-logo-v1.0', scoringCriteriaJson: JSON.stringify(DEFAULT_SCORING_CRITERIA),
        categories: { create: categories.map((c) => ({ categoryKey: c.categoryKey, label: c.label, score: clampScore(c.score), judgmentType: c.judgmentType, explanation: c.explanation, confidence: c.confidence, severity: c.severity, recommendation: c.recommendation })) },
        evidence: { create: evidence.map((e) => ({ categoryKey: e.categoryKey, sourceType: e.sourceType, assetId: e.assetId || null, assetVersion: e.assetVersion || null, measurementJson: JSON.stringify(e.measurement), finding: e.finding })) },
      },
      include: { categories: true, evidence: true },
    });

    await prisma.assessmentHistory.create({
      data: { workspaceId, projectId, assessmentId: assessment.id, action: 'LOGO_EVALUATED', summary: `Evaluated logo "${logo.originalFilename}" (advisory score: ${overallScore ?? 'N/A'})` },
    });

    return { assessment, visionNote: visionNote || null };
  }

  // MODULE 3: Visual Design Critic
  async critiqueDesign(
    workspaceId: string,
    projectId: string,
    userId: string,
    payload: { targetType: string; targetId: string; provider?: string; model?: string; allowCloudUpload?: boolean }
  ) {
    await this.getProjectContext(workspaceId, projectId);
    const regionFindings: Array<{ element: string; issue: string; recommendation: string; measurement?: Record<string, unknown> }> = [];
    let dimensions = { width: 1080, height: 1080 };
    let objectCount = 0;

    if (payload.targetType === 'DESIGN_DOCUMENT' || payload.targetType === 'BUSINESS_CARD' || payload.targetType === 'SOCIAL_MEDIA' || payload.targetType === 'PACKAGING') {
      const doc = await prisma.designDocument.findFirst({ where: { id: payload.targetId, projectId } });
      if (!doc) throw new AppError(404, 'DESIGN_NOT_FOUND', 'Design document not found.');
      dimensions = { width: doc.width, height: doc.height };
      const parsed = JSON.parse(doc.canvasJson || '{}') as { background?: string; objects?: Array<Record<string, unknown>> };
      const objs = parsed.objects || [];
      objectCount = objs.length;
      if (objs.length === 0) {
        regionFindings.push({ element: 'Canvas', issue: 'Canvas contains zero design objects.', recommendation: 'Instantiate a template or add logo/text elements.' });
      }
      for (const obj of objs) {
        if (typeof obj.fill === 'string' && typeof parsed.background === 'string' && obj.fill.startsWith('#') && parsed.background.startsWith('#')) {
          const contrast = computeWcagContrast(obj.fill, parsed.background);
          if (contrast.ratio < 4.5) {
            regionFindings.push({
              element: String(obj.type || 'element'),
              issue: `Low contrast (${contrast.ratio}:1) against background ${parsed.background}.`,
              recommendation: 'Adjust foreground or background color to reach >= 4.5:1 WCAG AA contrast.',
              measurement: { left: obj.left, top: obj.top, contrastRatio: contrast.ratio },
            });
          }
        }
      }
    }

    const categories: ScoringCategoryInput[] = [
      { categoryKey: 'layout', label: 'Layout & Composition', score: objectCount > 0 ? 82 : 40, judgmentType: 'DETERMINISTIC', explanation: `Canvas ${dimensions.width}x${dimensions.height} with ${objectCount} measured element(s).`, confidence: 0.9, severity: objectCount === 0 ? 'CRITICAL' : 'INFO', recommendation: objectCount === 0 ? 'Add structured grid elements.' : 'Maintain consistent margin grid.' },
      { categoryKey: 'contrast', label: 'Contrast & Readability', score: regionFindings.some((r) => r.issue.includes('Low contrast')) ? 54 : 88, judgmentType: 'DETERMINISTIC', explanation: regionFindings.length > 0 ? `${regionFindings.length} contrast/layout finding(s) detected from design data.` : 'All measured elements pass contrast baseline.', confidence: 0.92, severity: regionFindings.some((r) => r.issue.includes('Low contrast')) ? 'MAJOR' : 'INFO', recommendation: 'Ensure all text elements achieve WCAG AA (>= 4.5:1).' },
      { categoryKey: 'visual_hierarchy', label: 'Visual Hierarchy & Balance', score: 78, judgmentType: 'AI_SUBJECTIVE', explanation: 'Advisory creative critique of focal point and spacing.', confidence: 0.7, severity: 'INFO', recommendation: 'Keep primary headline at >= 1.5x body font size.' },
    ];
    const evidence: EvidenceInput[] = [
      { categoryKey: 'layout', sourceType: 'DESIGN_JSON', assetId: payload.targetId, measurement: { ...dimensions, objectCount }, finding: `Inspected ${objectCount} object(s) on ${dimensions.width}x${dimensions.height} canvas.` },
    ];
    const overallScore = computeOverallAdvisoryScore(categories, evidence);

    const report = await prisma.designCriticReport.create({
      data: {
        workspaceId, projectId, targetType: payload.targetType, targetId: payload.targetId,
        overallScore, critiqueJson: JSON.stringify(categories), regionFindingsJson: JSON.stringify(regionFindings),
        provider: payload.provider || 'heuristic', model: payload.model || 'design-json-inspector-v1',
      },
    });
    await prisma.assessmentHistory.create({
      data: { workspaceId, projectId, assessmentId: report.id, action: 'DESIGN_CRITIQUED', summary: `Critiqued ${payload.targetType} (${payload.targetId})` },
    });
    return report;
  }

  // MODULE 4: Brand Consistency Intelligence
  async analyzeConsistency(workspaceId: string, projectId: string) {
    const ctx = await this.getProjectContext(workspaceId, projectId);
    const { project, approvedDna, latestDraftDna } = ctx;
    const dna = approvedDna || latestDraftDna;

    const issues: Array<{ severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OPTIONAL'; area: string; message: string; assetId?: string; assetVersion?: number; recommendation: string }> = [];

    if (!approvedDna) {
      issues.push({ severity: 'CRITICAL', area: 'brand_dna', message: 'Brand DNA is not yet approved.', assetId: latestDraftDna?.id, assetVersion: latestDraftDna?.version, recommendation: 'Review and approve a Brand DNA version before locking production assets.' });
    }
    if (project.logos.length === 0) {
      issues.push({ severity: 'CRITICAL', area: 'original_logo', message: 'No original master logo uploaded.', recommendation: 'Upload a high-resolution or SVG master logo.' });
    }
    if (project.logoVariations.length < 10) {
      issues.push({ severity: 'MAJOR', area: 'logo_variations', message: `Only ${project.logoVariations.length}/10 logo variations generated.`, recommendation: 'Generate the complete 10-variation Logo System.' });
    }
    if (project.colorSystems.length === 0) {
      issues.push({ severity: 'MAJOR', area: 'color_system', message: 'No active Color System linked to Brand DNA.', recommendation: 'Generate and activate a Brand Color System.' });
    }
    if (project.typographySystems.length === 0) {
      issues.push({ severity: 'MAJOR', area: 'typography_system', message: 'No active Typography System configured.', recommendation: 'Generate a Brand Typography System.' });
    }
    if (project.brandGuidelines.length === 0) {
      issues.push({ severity: 'MINOR', area: 'brand_guidelines', message: 'Brand Guidelines document not yet generated.', recommendation: 'Generate the 20-section Brand Guidelines.' });
    }
    if (dna && project.mockupDocuments.length === 0) {
      issues.push({ severity: 'OPTIONAL', area: 'mockups', message: 'No brand mockups created yet.', recommendation: 'Create key stationery/digital mockups to validate real-world application.' });
    }

    const penalty = issues.reduce((acc, i) => acc + (i.severity === 'CRITICAL' ? 25 : i.severity === 'MAJOR' ? 15 : i.severity === 'MINOR' ? 8 : 3), 0);
    const consistencyScore = clampScore(100 - penalty);

    const report = await prisma.brandConsistencyReport.create({
      data: {
        workspaceId, projectId, consistencyScore,
        issuesJson: JSON.stringify(issues),
        recommendationsJson: JSON.stringify(issues.map((i) => ({ area: i.area, action: i.recommendation, severity: i.severity }))),
      },
    });
    await prisma.assessmentHistory.create({
      data: { workspaceId, projectId, assessmentId: report.id, action: 'CONSISTENCY_ANALYZED', summary: `Brand consistency score: ${consistencyScore}/100 (${issues.length} findings)` },
    });
    return report;
  }
}
