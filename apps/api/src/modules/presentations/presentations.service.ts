import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export class BrandPresentationsService {
  async generatePresentation(projectId: string, conceptId?: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { brandDnas: { include: { colors: true, typography: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] }, mockupDocuments: true },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null;
    const concept = conceptId ? project.concepts.find((c) => c.id === conceptId) || project.concepts[0] : project.concepts[0] || null;
    const brandName = dna?.brandName || project.name;
    const mockupRefs = project.mockupDocuments.slice(0, 4).map((m) => m.renderedPath).filter(Boolean) as string[];
    const initialSlides = [
      { slideType: 'COVER', title: brandName, subtitle: 'Brand Identity Presentation (16:9)', body: dna?.industry || project.industry || 'Brand Identity Showcase', layout: 'HERO', imageRefs: [] },
      { slideType: 'CONCEPT', title: 'Concept Overview', subtitle: concept?.conceptName || 'Approved Direction', body: concept?.description || dna?.visualDirection || 'Strategic visual direction.', layout: 'SPLIT', imageRefs: [] },
      { slideType: 'LOGO', title: 'Logo Presentation', subtitle: 'Master Mark & System', body: concept?.logoApplicationDirection || 'Primary, secondary, and monochrome logo architecture.', layout: 'SPLIT', imageRefs: [] },
      { slideType: 'COLOR', title: 'Color Presentation', subtitle: 'Brand Palette & Contrast', body: dna?.colors.map((c) => `${c.role}: ${c.hex}`).join(' · ') || 'Primary & secondary color system.', layout: 'GRID', imageRefs: [] },
      { slideType: 'TYPOGRAPHY', title: 'Typography Presentation', subtitle: 'Type Hierarchy', body: dna?.typography ? `${dna.typography.headingFont} (Headings) + ${dna.typography.bodyFont} (Body)` : 'Display, Heading, and Body pairings.', layout: 'SPLIT', imageRefs: [] },
      { slideType: 'MOCKUP_GALLERY', title: 'Mockup Gallery', subtitle: 'Real-World Context', body: `${project.mockupDocuments.length} rendered brand mockups.`, layout: 'GALLERY', imageRefs: mockupRefs },
      { slideType: 'APPLICATIONS', title: 'Brand Applications', subtitle: 'Stationery, Digital & Packaging', body: 'Consistent deployment across print, packaging, and digital channels.', layout: 'GRID', imageRefs: mockupRefs },
      { slideType: 'CLOSING', title: 'Thank You', subtitle: `${brandName} Brand Studio`, body: 'All assets versioned and traceable to Brand DNA.', layout: 'HERO', imageRefs: [] },
    ];
    return prisma.brandPresentation.create({
      data: {
        projectId, conceptId: concept?.id || null, title: `${brandName} Brand Deck`, aspectRatio: '16:9', currentVersion: 1,
        slides: { create: initialSlides.map((s, idx) => ({ slideType: s.slideType, title: s.title, subtitle: s.subtitle, body: s.body, layout: s.layout, imageRefsJson: JSON.stringify(s.imageRefs), orderIndex: idx })) },
        versions: { create: { version: 1, snapshotJson: JSON.stringify(initialSlides), changeNote: 'Initial 16:9 presentation' } },
      },
      include: { slides: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } },
    });
  }

  async listPresentations(projectId: string) {
    return prisma.brandPresentation.findMany({ where: { projectId }, include: { slides: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } }, orderBy: { updatedAt: 'desc' } });
  }

  async updateSlideAndSaveVersion(projectId: string, presentationId: string, slideId: string, payload: { title?: string; subtitle?: string; body?: string; layout?: string; orderIndex?: number }) {
    const pres = await prisma.brandPresentation.findFirst({ where: { id: presentationId, projectId } });
    if (!pres) throw new AppError(404, 'PRESENTATION_NOT_FOUND', 'Presentation not found.');
    await prisma.presentationSlide.update({ where: { id: slideId }, data: { ...(payload.title !== undefined ? { title: payload.title } : {}), ...(payload.subtitle !== undefined ? { subtitle: payload.subtitle } : {}), ...(payload.body !== undefined ? { body: payload.body } : {}), ...(payload.layout !== undefined ? { layout: payload.layout } : {}), ...(payload.orderIndex !== undefined ? { orderIndex: payload.orderIndex } : {}) } });
    const slides = await prisma.presentationSlide.findMany({ where: { presentationId }, orderBy: { orderIndex: 'asc' } });
    const nextVersion = pres.currentVersion + 1;
    return prisma.brandPresentation.update({
      where: { id: presentationId },
      data: { currentVersion: nextVersion, versions: { create: { version: nextVersion, snapshotJson: JSON.stringify(slides), changeNote: 'Updated slide' } } },
      include: { slides: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } },
    });
  }

  async addSlide(projectId: string, presentationId: string, payload: { title: string; subtitle?: string; body: string; layout?: string }) {
    const pres = await prisma.brandPresentation.findFirst({ where: { id: presentationId, projectId }, include: { slides: true } });
    if (!pres) throw new AppError(404, 'PRESENTATION_NOT_FOUND', 'Presentation not found.');
    await prisma.presentationSlide.create({ data: { presentationId, slideType: 'CUSTOM', title: payload.title, subtitle: payload.subtitle || '', body: payload.body, layout: payload.layout || 'SPLIT', orderIndex: pres.slides.length } });
    return prisma.brandPresentation.findUnique({ where: { id: presentationId }, include: { slides: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } } });
  }

  async deleteSlide(projectId: string, presentationId: string, slideId: string) {
    const pres = await prisma.brandPresentation.findFirst({ where: { id: presentationId, projectId } });
    if (!pres) throw new AppError(404, 'PRESENTATION_NOT_FOUND', 'Presentation not found.');
    await prisma.presentationSlide.delete({ where: { id: slideId } });
    return prisma.brandPresentation.findUnique({ where: { id: presentationId }, include: { slides: { orderBy: { orderIndex: 'asc' } }, versions: { orderBy: { version: 'desc' } } } });
  }
}
