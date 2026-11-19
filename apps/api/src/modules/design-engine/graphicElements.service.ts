import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);
export const GRAPHIC_ELEMENT_TYPES = ['ICON', 'SHAPE', 'PATTERN', 'DECORATIVE', 'BACKGROUND', 'ILLUSTRATION'] as const;
export type GraphicElementType = (typeof GRAPHIC_ELEMENT_TYPES)[number];

function buildElementSvg(elementType: GraphicElementType, primaryHex: string, secondaryHex: string, accentHex: string): string {
  switch (elementType) {
    case 'ICON': return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="28" y="28" width="200" height="200" rx="44" fill="${primaryHex}" fill-opacity="0.14" stroke="${primaryHex}" stroke-width="8"/><path d="M84 128 L116 160 L176 96" fill="none" stroke="${primaryHex}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'SHAPE': return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><polygon points="128,20 232,80 232,176 128,236 24,176 24,80" fill="${primaryHex}" fill-opacity="0.85"/><circle cx="128" cy="128" r="46" fill="${accentHex}"/></svg>`;
    case 'PATTERN': return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><pattern id="brandGrid" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="4" fill="${primaryHex}" fill-opacity="0.45"/><path d="M0 20 H40 M20 0 V40" stroke="${secondaryHex}" stroke-opacity="0.12" stroke-width="1"/></pattern></defs><rect width="400" height="400" fill="url(#brandGrid)"/></svg>`;
    case 'DECORATIVE': return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><path d="M16 140 Q110 20 200 100 T384 60" fill="none" stroke="${primaryHex}" stroke-width="10" stroke-linecap="round"/><circle cx="384" cy="60" r="12" fill="${accentHex}"/></svg>`;
    case 'BACKGROUND': return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="${secondaryHex}"/><circle cx="680" cy="90" r="180" fill="${primaryHex}" fill-opacity="0.24"/><circle cx="120" cy="390" r="150" fill="${accentHex}" fill-opacity="0.18"/></svg>`;
    case 'ILLUSTRATION': return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect x="48" y="72" width="304" height="256" rx="28" fill="${secondaryHex}"/><rect x="80" y="108" width="140" height="24" rx="12" fill="${accentHex}"/><circle cx="290" cy="256" r="42" fill="${primaryHex}"/></svg>`;
  }
}

export class GraphicElementsService {
  async generateElementSet(projectId: string, opts?: { format?: 'SVG' | 'PNG' }) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { colors: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] } } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null, concept = project.concepts[0] || null;
    const primaryHex = dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
    const secondaryHex = dna?.colors.find((c) => c.role === 'SECONDARY')?.hex || '#0F172A';
    const accentHex = dna?.colors.find((c) => c.role === 'ACCENT')?.hex || '#38BDF8';
    const format = opts?.format || 'SVG';
    const created = [];
    for (const elementType of GRAPHIC_ELEMENT_TYPES) {
      const id = `elem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const svg = buildElementSvg(elementType, primaryHex, secondaryHex, accentHex);
      const buffer = format === 'PNG' ? await sharp(Buffer.from(svg, 'utf8')).png().toBuffer() : Buffer.from(svg, 'utf8');
      const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'elements', filename: `${elementType.toLowerCase()}-${id}.${format.toLowerCase()}`, buffer });
      const elem = await prisma.graphicElement.create({ data: { id, projectId, conceptId: concept?.id || null, elementType, name: `${project.name} · ${elementType}`, format, storagePath: saved.storagePath, svgContent: format === 'SVG' ? svg : null, version: 1, aiProvider: 'brand-dna-svg' } });
      created.push(elem);
      await prisma.brandAsset.create({ data: { projectId, conceptId: concept?.id || null, name: elem.name, category: 'GRAPHIC_ELEMENT', assetType: format, storagePath: saved.storagePath, mimeType: format === 'PNG' ? 'image/png' : 'image/svg+xml', version: 1, aiProvider: 'brand-dna-svg' } });
    }
    return created;
  }
  async listElements(projectId: string) { return prisma.graphicElement.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }); }
}
