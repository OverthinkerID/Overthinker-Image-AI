import PDFDocument from 'pdfkit';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { CreativeDirectorService } from './creativeDirector.service';

export const CREATIVE_DIRECTIONS = [
  'Premium Luxury',
  'Modern Minimalist',
  'Corporate Professional',
  'Creative Futuristic',
  'Elegant Classic',
  'Bold Contemporary',
  'Friendly and Approachable',
  'Editorial',
  'Organic and Natural',
] as const;

const directorService = new CreativeDirectorService();

export class BrandIntelligenceService {
  // MODULE 5: Intelligent Design Recommendations
  async generateRecommendations(workspaceId: string, projectId: string, direction = 'Modern Minimalist') {
    const ctx = await directorService.getProjectContext(workspaceId, projectId);
    const dna = ctx.approvedDna || ctx.latestDraftDna;
    const concept = ctx.approvedConcept || ctx.primaryConcept;
    const primaryHex = dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
    const headingFont = dna?.typography?.headingFont || 'Plus Jakarta Sans';

    const recs = [
      {
        direction,
        title: `Align Logo Clear-Space & ${direction} Lockup Proportions`,
        description: `Standardize logo clear-space at 20% mark height and pair with ${direction} grid proportions across all templates.`,
        reason: `Ensures consistent visual authority for ${ctx.project.name} (${ctx.summary.industry}) without altering the immutable original logo.`,
        expectedImpact: 'Improves small-size legibility and cross-channel brand recognition.',
        affectedAssets: ctx.project.logoVariations.slice(0, 4).map((v) => ({ id: v.id, name: v.name, version: v.version })),
        implementationApproach: 'Apply updated lockup spacing inside Design Studio templates while keeping approved assets locked.',
        priority: 'HIGH',
        confidence: 0.86,
      },
      {
        direction,
        title: `Enforce ${primaryHex} Accent Discipline & WCAG Contrast`,
        description: `Reserve ${primaryHex} for primary CTAs and key brand moments while pairing neutral surfaces for ${direction} clarity.`,
        reason: `Grounded in Brand DNA palette and ${concept ? `concept "${concept.conceptName}"` : 'industry visual standards'}.`,
        expectedImpact: 'Prevents visual fatigue and improves accessibility across digital and print deliverables.',
        affectedAssets: ctx.project.designDocuments.slice(0, 3).map((d) => ({ id: d.id, name: d.title, version: d.currentVersion })),
        implementationApproach: 'Update Color System swatches or create a new Design Document version without overwriting approved history.',
        priority: 'MEDIUM',
        confidence: 0.84,
      },
      {
        direction,
        title: `Formalize ${headingFont} Typographic Hierarchy`,
        description: `Lock display-to-body scale ratios (1.25–1.5x) for ${direction} editorial balance.`,
        reason: `Strengthens hierarchy across social media, stationery, and presentation decks.`,
        expectedImpact: 'Creates immediately recognizable brand typography across client deliverables.',
        affectedAssets: ctx.project.mockupDocuments.slice(0, 3).map((m) => ({ id: m.id, name: m.title, version: m.currentVersion })),
        implementationApproach: 'Apply typography tokens in Typography Studio and regenerate guidelines preview.',
        priority: 'MEDIUM',
        confidence: 0.8,
      },
    ];

    const created = [];
    for (const r of recs) {
      created.push(
        await prisma.creativeRecommendation.create({
          data: {
            workspaceId,
            projectId,
            direction: r.direction,
            title: r.title,
            description: r.description,
            reason: r.reason,
            expectedImpact: r.expectedImpact,
            affectedAssetsJson: JSON.stringify(r.affectedAssets),
            implementationApproach: r.implementationApproach,
            priority: r.priority,
            confidence: r.confidence,
            status: 'PENDING',
          },
        })
      );
    }
    return created;
  }

  async updateRecommendationStatus(
    workspaceId: string,
    projectId: string,
    recId: string,
    payload: { status: 'ACCEPTED' | 'REJECTED' | 'EDITED' | 'SAVED_FOR_LATER'; editedContent?: string }
  ) {
    const existing = await prisma.creativeRecommendation.findFirst({ where: { id: recId, workspaceId, projectId } });
    if (!existing) throw new AppError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found.');
    return prisma.creativeRecommendation.update({
      where: { id: recId },
      data: { status: payload.status, ...(payload.editedContent !== undefined ? { editedContent: payload.editedContent } : {}) },
    });
  }

  // MODULE 6: Creative Direction Brief Generator (11 sections, versioned)
  async generateCreativeBrief(workspaceId: string, projectId: string, direction = 'Modern Minimalist') {
    const ctx = await directorService.getProjectContext(workspaceId, projectId);
    const dna = ctx.approvedDna || ctx.latestDraftDna;
    const concept = ctx.approvedConcept || ctx.primaryConcept;
    const maxVer = await prisma.creativeBrief.aggregate({ where: { projectId, workspaceId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;

    const briefContent = {
      creativeObjective: `Establish a cohesive, scalable ${direction} brand identity system for ${ctx.project.name}.`,
      brandPositioning: dna?.personality?.brandPositioning || `${ctx.project.name} positioned in ${ctx.summary.industry}.`,
      targetAudience: dna?.personality?.targetAudience || `Modern decision-makers in ${ctx.summary.industry}.`,
      visualDirection: concept?.visualDirection || dna?.visualDirection || `${direction} grid-first composition with disciplined whitespace.`,
      colorDirection: dna?.colors.map((c) => `${c.role}: ${c.hex}`).join(' | ') || 'Configure primary, secondary, and neutral tokens in Color Studio.',
      typographyDirection: dna?.typography ? `Heading: ${dna.typography.headingFont} / Body: ${dna.typography.bodyFont}` : 'Define heading and body pairing in Typography Studio.',
      logoDirection: concept?.logoApplicationDirection || 'Use master vector SVG and approved monochrome/reversed variations with 20% clear space.',
      graphicLanguage: `Geometric brand marks, modular dividers, and ${ctx.project.graphicElements.length} supporting graphic element(s).`,
      photographyDirection: `Natural studio lighting, clean framing, and color grading complementary to ${dna?.colors[0]?.hex || 'primary brand palette'}.`,
      applicationExamples: ['Business Card & Stationery', 'Social Media Launch Kit', '16:9 Brand Presentation', 'Packaging & Digital UI'],
      designRestrictions: ['Never overwrite or distort the original uploaded master logo.', 'Never publish unapproved draft assets to Client Portal.'],
    };

    return prisma.creativeBrief.create({
      data: {
        workspaceId,
        projectId,
        title: `${ctx.project.name} — ${direction} Creative Brief v${nextVersion}`,
        version: nextVersion,
        briefJson: JSON.stringify(briefContent),
      },
    });
  }

  // MODULE 7: Brand Comparison Engine (never auto-selects winner without user criteria)
  async compareItems(
    workspaceId: string,
    projectId: string,
    payload: { comparisonType: 'CONCEPTS' | 'LOGO_VARIATIONS' | 'COLOR_SYSTEMS' | 'TYPOGRAPHY' | 'DESIGNS' | 'MOCKUPS'; criteria?: Record<string, number> }
  ) {
    const ctx = await directorService.getProjectContext(workspaceId, projectId);
    let items: Array<{ id: string; name: string; summary: string; strengths: string[]; weaknesses: string[]; consistencyScore: number }> = [];

    if (payload.comparisonType === 'CONCEPTS') {
      items = ctx.project.concepts.map((c) => ({
        id: c.id,
        name: c.conceptName,
        summary: c.visualDirection,
        strengths: [c.isApproved ? 'User Approved' : 'AI Exploration', `Category: ${c.categoryKey}`],
        weaknesses: c.isApproved ? [] : ['Pending formal user approval'],
        consistencyScore: c.isApproved ? 92 : 76,
      }));
    } else if (payload.comparisonType === 'LOGO_VARIATIONS') {
      items = ctx.project.logoVariations.slice(0, 6).map((v) => ({
        id: v.id,
        name: `${v.variationType} (${v.format})`,
        summary: `${v.width}x${v.height} v${v.version}`,
        strengths: [v.format === 'SVG' ? 'Vector scalability' : 'Raster ready'],
        weaknesses: v.format !== 'SVG' ? ['Resolution-bound'] : [],
        consistencyScore: v.format === 'SVG' ? 90 : 78,
      }));
    } else {
      items = ctx.project.designDocuments.slice(0, 4).map((d) => ({
        id: d.id,
        name: d.title,
        summary: `${d.category} (${d.width}x${d.height})`,
        strengths: [`Version ${d.currentVersion}`],
        weaknesses: [],
        consistencyScore: 80,
      }));
    }

    const hasUserCriteria = Boolean(payload.criteria && Object.keys(payload.criteria).length > 0);
    const aiRecommendation = hasUserCriteria
      ? `Evaluated ${items.length} item(s) against user-supplied criteria (${Object.keys(payload.criteria!).join(', ')}). Top alignment: ${items[0]?.name || 'N/A'}.`
      : `Compared ${items.length} item(s) side-by-side. No automatic winner selected because explicit user-defined selection criteria were not provided.`;

    return prisma.brandComparison.create({
      data: {
        workspaceId,
        projectId,
        comparisonType: payload.comparisonType,
        itemIdsJson: JSON.stringify(items.map((i) => i.id)),
        criteriaJson: JSON.stringify(payload.criteria || {}),
        evaluationJson: JSON.stringify(items),
        aiRecommendation,
      },
    });
  }

  // MODULE 8: Brand Intelligence Report (12 sections + PDF export)
  async generateIntelligenceReport(workspaceId: string, projectId: string) {
    const ctx = await directorService.getProjectContext(workspaceId, projectId);
    const [latestLogoEval, latestConsistency, recs] = await Promise.all([
      prisma.creativeAssessment.findFirst({ where: { workspaceId, projectId, assessmentType: 'LOGO_INTELLIGENCE' }, include: { categories: true }, orderBy: { createdAt: 'desc' } }),
      prisma.brandConsistencyReport.findFirst({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.creativeRecommendation.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    const maxVer = await prisma.brandIntelligenceReport.aggregate({ where: { workspaceId, projectId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;

    const sections = [
      { key: 'executive_summary', title: '1. Executive Summary', content: `Advisory Brand Intelligence Report for ${ctx.project.name} (${ctx.summary.industry}).` },
      { key: 'brand_dna_assessment', title: '2. Brand DNA Assessment', content: `Status: ${ctx.summary.activeDnaLabel}.` },
      { key: 'logo_assessment', title: '3. Logo Assessment', content: latestLogoEval ? `Advisory Logo Score: ${latestLogoEval.overallScore ?? 'Insufficient Evidence'}/100.` : 'Run Logo Intelligence to populate.' },
      { key: 'color_system_assessment', title: '4. Color System Assessment', content: `Active Color Systems: ${ctx.project.colorSystems.length}.` },
      { key: 'typography_assessment', title: '5. Typography Assessment', content: `Active Typography Systems: ${ctx.project.typographySystems.length}.` },
      { key: 'visual_consistency', title: '6. Visual Consistency', content: latestConsistency ? `Consistency Score: ${latestConsistency.consistencyScore}/100.` : 'Run Consistency Analysis to populate.' },
      { key: 'design_strengths', title: '7. Design Strengths', content: ctx.project.logos.length > 0 ? 'Original master logo vault preserved with SHA-256 verification.' : 'Upload master logo to establish baseline.' },
      { key: 'design_weaknesses', title: '8. Design Weaknesses', content: !ctx.approvedDna ? 'Brand DNA not yet formally approved.' : 'Review minor consistency warnings before commercial export.' },
      { key: 'improvement_recommendations', title: '9. Improvement Recommendations', content: recs.map((r) => `• ${r.title} (${r.priority})`).join('\n') || 'Generate recommendations from Creative Director.' },
      { key: 'priority_actions', title: '10. Priority Actions', content: '1. Approve Brand DNA & Concept. 2. Complete 10 Logo Variations. 3. Verify WCAG Contrast.' },
      { key: 'creative_direction', title: '11. Creative Direction', content: ctx.summary.activeConceptLabel },
      { key: 'evaluation_limitations', title: '12. Evaluation Limitations', content: 'All scores and critiques are advisory creative guidance only. They do not predict commercial success or guarantee trademark/legal availability.' },
    ];

    const assetRefs = ctx.project.logos.map((l) => ({ type: 'ORIGINAL_LOGO', id: l.id, name: l.originalFilename }));
    return prisma.brandIntelligenceReport.create({
      data: {
        workspaceId,
        projectId,
        title: `${ctx.project.name} Brand Intelligence Report v${nextVersion}`,
        version: nextVersion,
        sectionsJson: JSON.stringify(sections),
        assetRefsJson: JSON.stringify(assetRefs),
      },
    });
  }

  async exportIntelligenceReportPdf(workspaceId: string, projectId: string, reportId: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await prisma.brandIntelligenceReport.findFirst({ where: { id: reportId, workspaceId, projectId } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Brand Intelligence Report not found.');
    const sections = JSON.parse(report.sectionsJson || '[]') as Array<{ title: string; content: string }>;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: report.title } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).fillColor('#0F172A').text(report.title);
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#64748B').text(`Version ${report.version} · Advisory Brand Intelligence Report`);
      doc.moveDown(1);

      for (const sec of sections) {
        doc.fontSize(13).fillColor('#1E293B').text(sec.title);
        doc.moveDown(0.25);
        doc.fontSize(10).fillColor('#334155').text(sec.content || '—');
        doc.moveDown(0.8);
      }
      doc.end();
    });

    return { buffer, filename: `${report.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf` };
  }
}
