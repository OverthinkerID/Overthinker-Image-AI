import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export class BrandGuidelinesService {
  async generateGuidelines(projectId: string, conceptId?: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        brandDnas: { include: { colors: true, typography: true, personality: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] },
        concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] },
        logoVariations: true, graphicElements: true, mockupDocuments: true,
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null;
    const concept = conceptId ? project.concepts.find((c) => c.id === conceptId) || project.concepts[0] : project.concepts[0] || null;
    const brandName = dna?.brandName || project.name;
    const missingStory = !project.description?.trim();
    const storyContent = missingStory ? '[User Input Required: Add your authentic Brand Story and founding narrative here. Never auto-fabricated.]' : project.description!;
    const colorSummary = dna?.colors.map((c) => `${c.role}: ${c.hex} (${c.rgb})`).join('\n') || '[Generate Color System to populate exact swatches]';
    const typoSummary = dna?.typography ? `Heading Font: ${dna.typography.headingFont} | Body Font: ${dna.typography.bodyFont}` : '[Generate Typography System to populate font specifications]';
    const assetRefs = project.logoVariations.slice(0, 4).map((v) => v.storagePath);
    const mockupRefs = project.mockupDocuments.slice(0, 4).map((m) => m.renderedPath).filter(Boolean) as string[];

    const sectionsData = [
      { sectionKey: 'cover', title: '1. Cover', content: `${brandName} — Official Brand Identity Guidelines`, isPlaceholder: false, imageRefs: assetRefs.slice(0, 1) },
      { sectionKey: 'brand_introduction', title: '2. Brand Introduction', content: `Welcome to the official brand guidelines for ${brandName} (${dna?.industry || project.industry || 'Industry Unspecified'}).`, isPlaceholder: !dna?.industry && !project.industry, imageRefs: [] },
      { sectionKey: 'brand_story', title: '3. Brand Story', content: storyContent, isPlaceholder: missingStory, imageRefs: [] },
      { sectionKey: 'brand_positioning', title: '4. Brand Positioning', content: dna?.personality?.brandPositioning || '[User Input Required: Define Brand Positioning in Brand DNA.]', isPlaceholder: !dna?.personality?.brandPositioning, imageRefs: [] },
      { sectionKey: 'brand_personality', title: '5. Brand Personality', content: dna?.personality ? `Tone: ${dna.personality.brandTone}\nVisual Style: ${dna.personality.visualStyle}\nAudience: ${dna.personality.targetAudience}` : '[User Input Required: Run Brand DNA Personality analysis.]', isPlaceholder: !dna?.personality, imageRefs: [] },
      { sectionKey: 'logo_system', title: '6. Logo System', content: concept?.logoApplicationDirection || 'Always use approved master logo files from the Original Logo Vault.', isPlaceholder: false, imageRefs: assetRefs.slice(0, 2) },
      { sectionKey: 'logo_variations', title: '7. Logo Variations', content: `Available variations (${project.logoVariations.length}): ${project.logoVariations.map((v) => v.variationType).join(', ') || 'Generate Logo System in Phase 4.'}`, isPlaceholder: project.logoVariations.length === 0, imageRefs: assetRefs },
      { sectionKey: 'logo_clear_space', title: '8. Logo Clear Space', content: 'Maintain minimum clear space around all sides equal to 20% of the mark height.', isPlaceholder: false, imageRefs: [] },
      { sectionKey: 'minimum_logo_size', title: '9. Minimum Logo Size', content: 'Digital minimum width: 120px (icon mark: 32px). Print minimum width: 25mm.', isPlaceholder: false, imageRefs: [] },
      { sectionKey: 'incorrect_logo_usage', title: '10. Incorrect Logo Usage', content: 'Do not stretch, skew, rotate, add unapproved drop shadows, or alter the original uploaded master logo proportions.', isPlaceholder: false, imageRefs: [] },
      { sectionKey: 'color_palette', title: '11. Color Palette', content: colorSummary, isPlaceholder: !dna?.colors.length, imageRefs: [] },
      { sectionKey: 'typography', title: '12. Typography', content: typoSummary, isPlaceholder: !dna?.typography, imageRefs: [] },
      { sectionKey: 'iconography', title: '13. Iconography', content: `Brand icons and geometric marks (${project.graphicElements.filter((g) => g.elementType === 'ICON').length} generated).`, isPlaceholder: project.graphicElements.length === 0, imageRefs: [] },
      { sectionKey: 'patterns_and_graphics', title: '14. Patterns & Graphic Elements', content: `Supporting patterns, shapes, and backgrounds (${project.graphicElements.length} elements available).`, isPlaceholder: project.graphicElements.length === 0, imageRefs: [] },
      { sectionKey: 'photography_direction', title: '15. Photography Direction', content: dna?.visualDirection || '[User Input Required: Add photography mood, lighting, and framing notes.]', isPlaceholder: !dna?.visualDirection, imageRefs: [] },
      { sectionKey: 'stationery_applications', title: '16. Stationery Applications', content: 'Business cards, letterheads, envelopes, and invoices.', isPlaceholder: false, imageRefs: mockupRefs },
      { sectionKey: 'social_media_applications', title: '17. Social Media Applications', content: 'Instagram posts, stories, carousels, YouTube thumbnails, and banners.', isPlaceholder: false, imageRefs: mockupRefs },
      { sectionKey: 'packaging_applications', title: '18. Packaging Applications', content: 'Boxes, labels, pouches, bottles, and shopping bags.', isPlaceholder: false, imageRefs: mockupRefs },
      { sectionKey: 'merchandise_applications', title: '19. Merchandise Applications', content: 'T-shirts, uniforms, caps, mugs, and tumblers.', isPlaceholder: false, imageRefs: mockupRefs },
      { sectionKey: 'brand_consistency_rules', title: '20. Brand Consistency Rules', content: 'All generated assets and mockups must trace back to the approved Brand DNA and Concept.', isPlaceholder: false, imageRefs: [] },
    ];

    return prisma.brandGuideline.create({
      data: {
        projectId, conceptId: concept?.id || null, title: `${brandName} Brand Guidelines`, currentVersion: 1,
        sections: { create: sectionsData.map((s, idx) => ({ sectionKey: s.sectionKey, title: s.title, orderIndex: idx, content: s.content, imageRefsJson: JSON.stringify(s.imageRefs), isPlaceholder: s.isPlaceholder })) },
        versions: { create: { version: 1, snapshotJson: JSON.stringify(sectionsData), changeNote: 'Auto-generated 20-section Brand Guidelines' } },
      },
      include: { sections: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } },
    });
  }

  async getProjectGuidelines(projectId: string) {
    return prisma.brandGuideline.findMany({ where: { projectId }, include: { sections: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } }, orderBy: { updatedAt: 'desc' } });
  }

  async updateSectionAndSaveVersion(projectId: string, guidelineId: string, sectionId: string, payload: { title?: string; content?: string; layoutType?: string; imageRefs?: string[]; orderIndex?: number }) {
    const guideline = await prisma.brandGuideline.findFirst({ where: { id: guidelineId, projectId } });
    if (!guideline) throw new AppError(404, 'GUIDELINE_NOT_FOUND', 'Brand guideline not found.');
    await prisma.guidelineSection.update({
      where: { id: sectionId },
      data: { ...(payload.title !== undefined ? { title: payload.title } : {}), ...(payload.content !== undefined ? { content: payload.content, isPlaceholder: false } : {}), ...(payload.layoutType !== undefined ? { layoutType: payload.layoutType } : {}), ...(payload.imageRefs !== undefined ? { imageRefsJson: JSON.stringify(payload.imageRefs) } : {}), ...(payload.orderIndex !== undefined ? { orderIndex: payload.orderIndex } : {}) },
    });
    const updatedSections = await prisma.guidelineSection.findMany({ where: { guidelineId }, orderBy: { orderIndex: 'asc' } });
    const nextVersion = guideline.currentVersion + 1;
    return prisma.brandGuideline.update({
      where: { id: guidelineId },
      data: { currentVersion: nextVersion, versions: { create: { version: nextVersion, snapshotJson: JSON.stringify(updatedSections), changeNote: 'Edited section' } } },
      include: { sections: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } },
    });
  }
}
