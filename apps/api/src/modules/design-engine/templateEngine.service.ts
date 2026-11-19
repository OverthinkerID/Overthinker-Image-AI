import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export interface TemplateBlueprint { category: 'STATIONERY' | 'SOCIAL_MEDIA' | 'MARKETING' | 'PACKAGING'; templateKey: string; name: string; width: number; height: number; }

export const BUILTIN_TEMPLATES: TemplateBlueprint[] = [
  { category: 'STATIONERY', templateKey: 'business-card', name: 'Business Card (3.5×2 in)', width: 1050, height: 600 },
  { category: 'STATIONERY', templateKey: 'letterhead', name: 'Letterhead (A4)', width: 1240, height: 1754 },
  { category: 'STATIONERY', templateKey: 'envelope', name: 'Envelope (#10)', width: 1425, height: 618 },
  { category: 'STATIONERY', templateKey: 'invoice', name: 'Invoice Layout', width: 1240, height: 1754 },
  { category: 'STATIONERY', templateKey: 'id-card', name: 'Employee ID Card', width: 638, height: 1013 },
  { category: 'SOCIAL_MEDIA', templateKey: 'instagram-post', name: 'Instagram Post (1:1)', width: 1080, height: 1080 },
  { category: 'SOCIAL_MEDIA', templateKey: 'instagram-story', name: 'Instagram Story (9:16)', width: 1080, height: 1920 },
  { category: 'SOCIAL_MEDIA', templateKey: 'instagram-carousel', name: 'Instagram Carousel Slide', width: 1080, height: 1350 },
  { category: 'SOCIAL_MEDIA', templateKey: 'youtube-thumbnail', name: 'YouTube Thumbnail (16:9)', width: 1280, height: 720 },
  { category: 'SOCIAL_MEDIA', templateKey: 'social-banner', name: 'Social Media Banner', width: 1500, height: 500 },
  { category: 'MARKETING', templateKey: 'flyer', name: 'Promotional Flyer', width: 1275, height: 1650 },
  { category: 'MARKETING', templateKey: 'poster', name: 'Brand Poster', width: 1600, height: 2400 },
  { category: 'MARKETING', templateKey: 'brochure', name: 'Tri-Fold Brochure Cover', width: 1650, height: 1275 },
  { category: 'MARKETING', templateKey: 'banner', name: 'Web / Event Banner', width: 1920, height: 640 },
  { category: 'MARKETING', templateKey: 'presentation-cover', name: 'Presentation Cover (16:9)', width: 1920, height: 1080 },
  { category: 'PACKAGING', templateKey: 'product-box', name: 'Product Box Front', width: 1200, height: 1500 },
  { category: 'PACKAGING', templateKey: 'label', name: 'Adhesive Product Label', width: 900, height: 600 },
  { category: 'PACKAGING', templateKey: 'pouch', name: 'Stand-Up Pouch', width: 1100, height: 1600 },
  { category: 'PACKAGING', templateKey: 'bottle-label', name: 'Bottle Wrap Label', width: 1600, height: 700 },
  { category: 'PACKAGING', templateKey: 'shopping-bag', name: 'Retail Shopping Bag', width: 1200, height: 1400 },
];

export function buildFabricTemplateJson(params: { brandName: string; tagline: string; templateName: string; width: number; height: number; primaryHex: string; secondaryHex: string; accentHex: string; bgHex: string; textHex: string; headingFont: string; bodyFont: string }): string {
  const { width, height } = params;
  const pad = Math.round(Math.min(width, height) * 0.07);
  const titleSize = Math.max(24, Math.round(Math.min(width, height) * 0.065));
  const bodySize = Math.max(14, Math.round(titleSize * 0.42));
  return JSON.stringify({
    version: '6.4.3',
    background: params.bgHex,
    objects: [
      { type: 'Rect', left: 0, top: 0, width, height: Math.round(height * 0.14), fill: params.primaryHex, selectable: true, name: 'Header Accent Bar' },
      { type: 'Circle', left: width - pad - Math.round(Math.min(width, height) * 0.18), top: Math.round(height * 0.2), radius: Math.round(Math.min(width, height) * 0.09), fill: params.accentHex, opacity: 0.25, name: 'Brand Graphic Accent' },
      { type: 'Textbox', left: pad, top: Math.round(height * 0.28), width: width - pad * 2, text: params.brandName, fontFamily: params.headingFont, fontSize: titleSize, fontWeight: 'bold', fill: params.textHex, name: 'Brand Title' },
      { type: 'Textbox', left: pad, top: Math.round(height * 0.44), width: width - pad * 2, text: params.tagline || `${params.templateName} · Editable Brand Template`, fontFamily: params.bodyFont, fontSize: bodySize, fill: params.secondaryHex, name: 'Brand Tagline' },
      { type: 'Rect', left: pad, top: height - pad - 12, width: Math.round(width * 0.28), height: 8, rx: 4, ry: 4, fill: params.primaryHex, name: 'Footer Rule' },
    ],
  });
}

export class TemplateEngineService {
  async ensureBuiltinTemplates() {
    for (const bp of BUILTIN_TEMPLATES) {
      const existing = await prisma.designTemplate.findFirst({ where: { projectId: null, templateKey: bp.templateKey } });
      if (!existing) {
        await prisma.designTemplate.create({
          data: {
            projectId: null, category: bp.category, templateKey: bp.templateKey, name: bp.name, width: bp.width, height: bp.height,
            canvasJson: buildFabricTemplateJson({ brandName: 'Brand Name', tagline: bp.name, templateName: bp.name, width: bp.width, height: bp.height, primaryHex: '#2563EB', secondaryHex: '#475569', accentHex: '#38BDF8', bgHex: '#FFFFFF', textHex: '#0F172A', headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter' }),
            isCustom: false,
          },
        });
      }
    }
  }

  async listTemplates(projectId: string, category?: string) {
    await this.ensureBuiltinTemplates();
    return prisma.designTemplate.findMany({ where: { OR: [{ projectId: null }, { projectId }], ...(category && category !== 'ALL' ? { category } : {}) }, orderBy: [{ isCustom: 'desc' }, { category: 'asc' }, { name: 'asc' }] });
  }

  async instantiateTemplateForProject(projectId: string, templateId: string, opts?: { title?: string; width?: number; height?: number; conceptId?: string }) {
    const [project, template] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { colors: true, typography: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] } } }),
      prisma.designTemplate.findUnique({ where: { id: templateId } }),
    ]);
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    if (!template) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
    const dna = project.brandDnas[0] || null;
    const concept = opts?.conceptId ? project.concepts.find((c) => c.id === opts.conceptId) || project.concepts[0] : project.concepts[0] || null;
    const width = opts?.width || template.width, height = opts?.height || template.height;
    const canvasJson = template.isCustom ? template.canvasJson : buildFabricTemplateJson({
      brandName: dna?.brandName || project.name, tagline: project.description || `${project.name} · ${template.name}`, templateName: template.name, width, height,
      primaryHex: dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB',
      secondaryHex: dna?.colors.find((c) => c.role === 'SECONDARY')?.hex || '#475569',
      accentHex: dna?.colors.find((c) => c.role === 'ACCENT')?.hex || '#38BDF8',
      bgHex: '#FFFFFF', textHex: '#0F172A',
      headingFont: dna?.typography?.headingFont || 'Plus Jakarta Sans', bodyFont: dna?.typography?.bodyFont || 'Inter',
    });
    return prisma.designDocument.create({
      data: { projectId, conceptId: concept?.id || null, templateId: template.id, title: opts?.title || `${project.name} — ${template.name}`, category: template.category, width, height, canvasJson, currentVersion: 1, versions: { create: { version: 1, canvasJson, changeNote: `Created from template "${template.name}"` } } },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async saveCustomTemplate(projectId: string, payload: { name: string; category: string; width: number; height: number; canvasJson: string }) {
    return prisma.designTemplate.create({ data: { projectId, category: payload.category || 'MARKETING', templateKey: `custom-${Date.now()}`, name: payload.name, width: payload.width, height: payload.height, canvasJson: payload.canvasJson, isCustom: true } });
  }
}
