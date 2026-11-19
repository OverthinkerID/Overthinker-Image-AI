import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { formatColorStrings, hexToRgb } from '../analyzer/color.extractor';

export interface ColorSwatchSpec { group: 'primary' | 'secondary' | 'accent' | 'neutral' | 'lightBg' | 'darkBg'; name: string; hex: string; rgb: string; hsl: string; cmyk: string; }
export interface ContrastCheckResult { foreground: string; background: string; ratio: number; aaNormal: boolean; aaLarge: boolean; aaaNormal: boolean; }

export function rgbToCmyk(r: number, g: number, b: number): string {
  const rn = r / 255, gn = g / 255, bn = b / 255, k = 1 - Math.max(rn, gn, bn);
  if (k >= 0.999) return 'cmyk(0%, 0%, 0%, 100%)';
  return `cmyk(${Math.round(((1 - rn - k) / (1 - k)) * 100)}%, ${Math.round(((1 - gn - k) / (1 - k)) * 100)}%, ${Math.round(((1 - bn - k) / (1 - k)) * 100)}%, ${Math.round(k * 100)}%)`;
}

export function enrichHexColor(group: ColorSwatchSpec['group'], name: string, hex: string): ColorSwatchSpec {
  const rgb = hexToRgb(hex) || { r: 37, g: 99, b: 235 };
  const formatted = formatColorStrings(rgb.r, rgb.g, rgb.b);
  return { group, name, hex: formatted.hex, rgb: formatted.rgb, hsl: formatted.hsl, cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b) };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function computeWcagContrast(fgHex: string, bgHex: string): ContrastCheckResult {
  const l1 = relativeLuminance(fgHex), l2 = relativeLuminance(bgHex);
  const ratio = Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
  return { foreground: fgHex.toUpperCase(), background: bgHex.toUpperCase(), ratio, aaNormal: ratio >= 4.5, aaLarge: ratio >= 3.0, aaaNormal: ratio >= 7.0 };
}

export class ColorSystemService {
  async generateOrGetColorSystem(projectId: string, conceptId?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { colors: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] } } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null;
    const concept = conceptId ? project.concepts.find((c) => c.id === conceptId) || project.concepts[0] : project.concepts[0] || null;
    const getDnaHex = (role: string, fb: string) => dna?.colors.find((c) => c.role === role)?.hex || fb;
    const primaryHex = getDnaHex('PRIMARY', '#2563EB'), secondaryHex = getDnaHex('SECONDARY', '#1E293B'), accentHex = getDnaHex('ACCENT', '#38BDF8'), lightBgHex = getDnaHex('BG_LIGHT', '#FFFFFF'), darkBgHex = getDnaHex('BG_DARK', '#0B1120');
    const palettes: Record<ColorSwatchSpec['group'], ColorSwatchSpec[]> = {
      primary: [enrichHexColor('primary', 'Primary 500', primaryHex)],
      secondary: [enrichHexColor('secondary', 'Secondary 600', secondaryHex)],
      accent: [enrichHexColor('accent', 'Accent Highlight', accentHex)],
      neutral: [enrichHexColor('neutral', 'Neutral 100', getDnaHex('NEUTRAL_LIGHT', '#F1F5F9')), enrichHexColor('neutral', 'Neutral 900', getDnaHex('NEUTRAL_DARK', '#0F172A'))],
      lightBg: [enrichHexColor('lightBg', 'Light Surface', lightBgHex)],
      darkBg: [enrichHexColor('darkBg', 'Dark Surface', darkBgHex)],
    };
    const contrastChecks = [computeWcagContrast(primaryHex, lightBgHex), computeWcagContrast(primaryHex, darkBgHex), computeWcagContrast('#0F172A', lightBgHex), computeWcagContrast('#F8FAFC', darkBgHex)];
    const maxVer = await prisma.colorSystem.aggregate({ where: { projectId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;
    return prisma.$transaction(async (tx) => {
      await tx.colorSystem.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } });
      return tx.colorSystem.create({ data: { projectId, brandDnaId: dna?.id || null, conceptId: concept?.id || null, name: `${project.name} Color System v${nextVersion}`, version: nextVersion, palettesJson: JSON.stringify(palettes), contrastJson: JSON.stringify(contrastChecks), isActive: true } });
    });
  }

  async listColorSystems(projectId: string) { return prisma.colorSystem.findMany({ where: { projectId }, orderBy: { version: 'desc' } }); }

  async saveEditedColorSystem(projectId: string, palettes: Record<ColorSwatchSpec['group'], Array<{ name: string; hex: string }>>) {
    const enriched: Record<string, ColorSwatchSpec[]> = {};
    for (const [group, items] of Object.entries(palettes)) enriched[group] = items.map((item) => enrichHexColor(group as ColorSwatchSpec['group'], item.name, item.hex));
    const primaryHex = enriched.primary?.[0]?.hex || '#2563EB', lightBgHex = enriched.lightBg?.[0]?.hex || '#FFFFFF', darkBgHex = enriched.darkBg?.[0]?.hex || '#0B1120';
    const contrastChecks = [computeWcagContrast(primaryHex, lightBgHex), computeWcagContrast(primaryHex, darkBgHex), computeWcagContrast('#0F172A', lightBgHex), computeWcagContrast('#F8FAFC', darkBgHex)];
    const maxVer = await prisma.colorSystem.aggregate({ where: { projectId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;
    return prisma.$transaction(async (tx) => {
      await tx.colorSystem.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } });
      return tx.colorSystem.create({ data: { projectId, name: `Custom Color System v${nextVersion}`, version: nextVersion, palettesJson: JSON.stringify(enriched), contrastJson: JSON.stringify(contrastChecks), isActive: true } });
    });
  }
}
