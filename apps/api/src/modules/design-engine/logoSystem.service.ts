import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export const LOGO_VARIATION_TYPES = [
  'PRIMARY', 'SECONDARY', 'HORIZONTAL', 'VERTICAL', 'SYMBOL',
  'MONOGRAM', 'BLACK', 'WHITE', 'MONOCHROME', 'REVERSED',
] as const;
export type LogoVariationType = (typeof LOGO_VARIATION_TYPES)[number];

function escXml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function getInitials(brandName: string): string {
  const words = brandName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return brandName.slice(0, 2).toUpperCase() || 'OI';
}

function buildVariationSvg(params: { variationType: LogoVariationType; brandName: string; primaryHex: string; secondaryHex: string; headingFont: string; originalSvgBody?: string | null }) {
  const initials = escXml(getInitials(params.brandName));
  const brand = escXml(params.brandName);
  const font = escXml(params.headingFont || 'Plus Jakarta Sans');
  const p = params.primaryHex || '#2563EB';
  const s = params.secondaryHex || '#0F172A';
  switch (params.variationType) {
    case 'HORIZONTAL': return { width: 800, height: 240, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240" viewBox="0 0 800 240"><rect x="24" y="40" width="160" height="160" rx="32" fill="${p}"/><text x="104" y="138" text-anchor="middle" fill="#FFFFFF" font-family="${font}, sans-serif" font-size="64" font-weight="700">${initials}</text><text x="216" y="134" fill="${s}" font-family="${font}, sans-serif" font-size="52" font-weight="700">${brand}</text></svg>` };
    case 'VERTICAL': return { width: 480, height: 480, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><rect x="150" y="64" width="180" height="180" rx="36" fill="${p}"/><text x="240" y="176" text-anchor="middle" fill="#FFFFFF" font-family="${font}, sans-serif" font-size="72" font-weight="700">${initials}</text><text x="240" y="330" text-anchor="middle" fill="${s}" font-family="${font}, sans-serif" font-size="40" font-weight="700">${brand}</text></svg>` };
    case 'SYMBOL': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="56" y="56" width="400" height="400" rx="96" fill="${p}"/><circle cx="256" cy="256" r="120" fill="none" stroke="#FFFFFF" stroke-width="24"/><circle cx="256" cy="256" r="42" fill="#FFFFFF"/></svg>` };
    case 'MONOGRAM': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><circle cx="256" cy="256" r="210" fill="${p}"/><text x="256" y="294" text-anchor="middle" fill="#FFFFFF" font-family="${font}, sans-serif" font-size="148" font-weight="700">${initials}</text></svg>` };
    case 'BLACK': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="76" y="76" width="360" height="360" rx="72" fill="#000000"/><text x="256" y="286" text-anchor="middle" fill="#FFFFFF" font-family="${font}, sans-serif" font-size="120" font-weight="700">${initials}</text></svg>` };
    case 'WHITE': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="76" y="76" width="360" height="360" rx="72" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/><text x="256" y="286" text-anchor="middle" fill="#0F172A" font-family="${font}, sans-serif" font-size="120" font-weight="700">${initials}</text></svg>` };
    case 'MONOCHROME': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="76" y="76" width="360" height="360" rx="72" fill="#1E293B"/><text x="256" y="286" text-anchor="middle" fill="#F8FAFC" font-family="${font}, sans-serif" font-size="120" font-weight="700">${initials}</text></svg>` };
    case 'REVERSED': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="48" fill="${s}"/><rect x="116" y="116" width="280" height="280" rx="56" fill="#FFFFFF"/><text x="256" y="286" text-anchor="middle" fill="${s}" font-family="${font}, sans-serif" font-size="112" font-weight="700">${initials}</text></svg>` };
    case 'SECONDARY': return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="64" y="64" width="384" height="384" rx="80" fill="none" stroke="${p}" stroke-width="24"/><text x="256" y="288" text-anchor="middle" fill="${p}" font-family="${font}, sans-serif" font-size="128" font-weight="700">${initials}</text></svg>` };
    case 'PRIMARY':
    default:
      if (params.originalSvgBody) return { width: 512, height: 512, svg: params.originalSvgBody };
      return { width: 512, height: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="64" y="64" width="384" height="384" rx="80" fill="${p}"/><text x="256" y="288" text-anchor="middle" fill="#FFFFFF" font-family="${font}, sans-serif" font-size="128" font-weight="700">${initials}</text></svg>` };
  }
}

export class LogoSystemService {
  async generateVariationSet(projectId: string, opts?: { conceptId?: string; types?: LogoVariationType[] }) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        logos: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        brandDnas: { include: { colors: true, typography: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] },
        concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const parentLogo = project.logos[0] || null;
    const dna = project.brandDnas[0] || null;
    const concept = opts?.conceptId ? project.concepts.find((c) => c.id === opts.conceptId) || project.concepts[0] : project.concepts[0] || null;
    const primaryHex = dna?.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
    const secondaryHex = dna?.colors.find((c) => c.role === 'SECONDARY')?.hex || '#0F172A';
    const headingFont = dna?.typography?.headingFont || 'Plus Jakarta Sans';

    let originalSvgBody: string | null = null;
    let isRasterParent = false;
    let parentBuffer: Buffer | null = null;
    if (parentLogo) {
      parentBuffer = await storage.readLogo(parentLogo.storagePath);
      if (parentLogo.mimeType === 'image/svg+xml') originalSvgBody = parentBuffer.toString('utf8');
      else isRasterParent = true;
    }

    const targetTypes = opts?.types?.length ? opts.types : [...LOGO_VARIATION_TYPES];
    const created = [];
    for (const variationType of targetTypes) {
      const existingMax = await prisma.logoVariation.aggregate({ where: { projectId, variationType }, _max: { version: true } });
      const version = (existingMax._max.version || 0) + 1;
      const id = `lvar_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;

      if (isRasterParent && parentBuffer && ['PRIMARY', 'BLACK', 'WHITE', 'MONOCHROME'].includes(variationType)) {
        let pipeline = sharp(parentBuffer).ensureAlpha();
        if (variationType === 'MONOCHROME') pipeline = pipeline.grayscale();
        if (variationType === 'BLACK') pipeline = pipeline.grayscale().threshold(128);
        if (variationType === 'WHITE') pipeline = pipeline.grayscale().negate();
        const { data: pngBuf, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
        const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'variations', filename: `${variationType.toLowerCase()}-v${version}-${id}.png`, buffer: pngBuf });
        const record = await prisma.logoVariation.create({ data: { id, projectId, parentLogoId: parentLogo?.id || null, conceptId: concept?.id || null, variationType, name: `${project.name} · ${variationType}`, format: 'PNG', storagePath: saved.storagePath, width: info.width || 512, height: info.height || 512, version, notes: 'Generated from original raster logo via Sharp.' } });
        created.push(record);
        await prisma.brandAsset.create({ data: { projectId, conceptId: concept?.id || null, name: record.name, category: 'LOGO_VARIATION', assetType: 'PNG', storagePath: saved.storagePath, mimeType: 'image/png', width: record.width, height: record.height, version, aiProvider: 'sharp-raster' } });
        continue;
      }

      const { svg, width, height } = buildVariationSvg({ variationType, brandName: dna?.brandName || project.name, primaryHex, secondaryHex, headingFont, originalSvgBody: variationType === 'PRIMARY' ? originalSvgBody : null });
      const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'variations', filename: `${variationType.toLowerCase()}-v${version}-${id}.svg`, buffer: Buffer.from(svg, 'utf8') });
      const record = await prisma.logoVariation.create({ data: { id, projectId, parentLogoId: parentLogo?.id || null, conceptId: concept?.id || null, variationType, name: `${project.name} · ${variationType}`, format: 'SVG', storagePath: saved.storagePath, svgContent: svg, width, height, version } });
      created.push(record);
      await prisma.brandAsset.create({ data: { projectId, conceptId: concept?.id || null, name: record.name, category: 'LOGO_VARIATION', assetType: 'SVG', storagePath: saved.storagePath, mimeType: 'image/svg+xml', width, height, version, aiProvider: 'brand-dna-svg' } });
    }
    return created;
  }

  async listVariations(projectId: string) { return prisma.logoVariation.findMany({ where: { projectId }, orderBy: [{ variationType: 'asc' }, { version: 'desc' }] }); }

  async updateVariation(projectId: string, variationId: string, payload: { name?: string; svgContent?: string; notes?: string }) {
    const existing = await prisma.logoVariation.findFirst({ where: { id: variationId, projectId } });
    if (!existing) throw new AppError(404, 'VARIATION_NOT_FOUND', 'Logo variation not found.');
    let storagePath = existing.storagePath;
    if (payload.svgContent && existing.format === 'SVG') {
      storagePath = (await storage.saveProjectScopedAsset({ projectId, folder: 'variations', filename: `${existing.variationType.toLowerCase()}-v${existing.version}-${existing.id}-edited.svg`, buffer: Buffer.from(payload.svgContent, 'utf8') })).storagePath;
    }
    return prisma.logoVariation.update({ where: { id: variationId }, data: { ...(payload.name ? { name: payload.name } : {}), ...(payload.svgContent ? { svgContent: payload.svgContent, storagePath } : {}), ...(payload.notes !== undefined ? { notes: payload.notes } : {}), isEdited: true } });
  }
}
