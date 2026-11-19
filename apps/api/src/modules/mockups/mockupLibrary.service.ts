import { prisma } from '../../db/client';

export interface MockupTemplateSeed {
  category: 'STATIONERY' | 'PACKAGING' | 'ENVIRONMENT' | 'MERCHANDISE' | 'DIGITAL' | 'RETAIL';
  templateKey: string; name: string; description: string; width: number; height: number;
  placement: { x: number; y: number; maxW: number; maxH: number; skewDeg?: number; maskShape?: string };
  capabilities: { supportsPerspective: boolean; supportsMask: boolean; supportsDisplacement: boolean; supportsColorChange: boolean; supportsBgChange: boolean; supportsTextReplace: boolean };
}

export const BUILTIN_MOCKUP_TEMPLATES: MockupTemplateSeed[] = [
  { category: 'STATIONERY', templateKey: 'business-cards', name: 'Business Cards Stack', description: 'Matte dual-card desk scene', width: 1200, height: 900, placement: { x: 420, y: 310, maxW: 360, maxH: 200, skewDeg: -4 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'STATIONERY', templateKey: 'letterheads', name: 'Executive Letterhead', description: 'A4 stationery sheet', width: 1200, height: 900, placement: { x: 460, y: 180, maxW: 280, maxH: 120 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'STATIONERY', templateKey: 'envelopes', name: 'Corporate Envelope', description: 'DL/C5 branded envelope', width: 1200, height: 900, placement: { x: 360, y: 300, maxW: 320, maxH: 150 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'STATIONERY', templateKey: 'invoices', name: 'Branded Invoice Sheet', description: 'Billing header mockup', width: 1200, height: 900, placement: { x: 410, y: 160, maxW: 260, maxH: 110 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'STATIONERY', templateKey: 'folders', name: 'Presentation Folder', description: 'Pocket folder cover', width: 1200, height: 900, placement: { x: 450, y: 320, maxW: 300, maxH: 220, skewDeg: 3 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'PACKAGING', templateKey: 'boxes', name: 'Product Box Mockup', description: '3D rigid carton front', width: 1200, height: 900, placement: { x: 440, y: 290, maxW: 320, maxH: 260, skewDeg: -6 }, capabilities: { supportsPerspective: true, supportsMask: true, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'PACKAGING', templateKey: 'bottles', name: 'Glass Bottle Label', description: 'Cylindrical bottle wrap', width: 1200, height: 900, placement: { x: 490, y: 340, maxW: 220, maxH: 240, maskShape: 'rounded' }, capabilities: { supportsPerspective: true, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'PACKAGING', templateKey: 'labels', name: 'Adhesive Product Label', description: 'Die-cut sticker label', width: 1200, height: 900, placement: { x: 440, y: 300, maxW: 320, maxH: 260, maskShape: 'circle' }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'PACKAGING', templateKey: 'pouches', name: 'Stand-Up Kraft Pouch', description: 'Flexible pouch front', width: 1200, height: 900, placement: { x: 460, y: 320, maxW: 280, maxH: 260 }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'PACKAGING', templateKey: 'shopping-bags', name: 'Kraft Shopping Bag', description: 'Boutique carry bag', width: 1200, height: 900, placement: { x: 450, y: 350, maxW: 300, maxH: 240, skewDeg: 2 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'ENVIRONMENT', templateKey: 'storefront-signs', name: 'Storefront Facade Sign', description: 'Architectural exterior sign', width: 1200, height: 900, placement: { x: 380, y: 240, maxW: 440, maxH: 180, skewDeg: -5 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'ENVIRONMENT', templateKey: 'office-walls', name: 'Office Lobby Wall', description: '3D acrylic wall logo', width: 1200, height: 900, placement: { x: 400, y: 260, maxW: 400, maxH: 220 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'ENVIRONMENT', templateKey: 'interior-branding', name: 'Interior Wayfinding', description: 'Glass & wall signage', width: 1200, height: 900, placement: { x: 420, y: 280, maxW: 360, maxH: 200 }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'ENVIRONMENT', templateKey: 'reception-desks', name: 'Reception Desk Front', description: 'Studio welcome counter', width: 1200, height: 900, placement: { x: 430, y: 380, maxW: 340, maxH: 160 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'ENVIRONMENT', templateKey: 'outdoor-signage', name: 'Outdoor Street Billboard', description: 'Urban citylight display', width: 1200, height: 900, placement: { x: 390, y: 190, maxW: 420, maxH: 340 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'MERCHANDISE', templateKey: 't-shirts', name: 'Apparel T-Shirt Chest', description: 'Cotton tee print area', width: 1200, height: 900, placement: { x: 470, y: 290, maxW: 260, maxH: 220 }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'MERCHANDISE', templateKey: 'uniforms', name: 'Staff Polo Uniform', description: 'Left-chest embroidery zone', width: 1200, height: 900, placement: { x: 620, y: 300, maxW: 160, maxH: 140 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'MERCHANDISE', templateKey: 'caps', name: 'Embroidered Cap', description: 'Structured cap crown', width: 1200, height: 900, placement: { x: 490, y: 280, maxW: 220, maxH: 150, skewDeg: -3 }, capabilities: { supportsPerspective: true, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'MERCHANDISE', templateKey: 'mugs', name: 'Ceramic Coffee Mug', description: '11oz ceramic wrap', width: 1200, height: 900, placement: { x: 460, y: 320, maxW: 240, maxH: 200 }, capabilities: { supportsPerspective: true, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'MERCHANDISE', templateKey: 'tumblers', name: 'Insulated Tumbler', description: 'Matte steel bottle', width: 1200, height: 900, placement: { x: 500, y: 300, maxW: 200, maxH: 240 }, capabilities: { supportsPerspective: true, supportsMask: true, supportsDisplacement: true, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'DIGITAL', templateKey: 'website', name: 'Desktop Website Hero', description: 'Browser landing header', width: 1200, height: 900, placement: { x: 180, y: 180, maxW: 220, maxH: 90 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'DIGITAL', templateKey: 'mobile-app', name: 'Mobile App Splash', description: 'Smartphone UI screen', width: 1200, height: 900, placement: { x: 490, y: 290, maxW: 220, maxH: 220, maskShape: 'rounded' }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'DIGITAL', templateKey: 'desktop-app', name: 'Desktop App Window', description: 'SaaS dashboard shell', width: 1200, height: 900, placement: { x: 170, y: 170, maxW: 200, maxH: 80 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'DIGITAL', templateKey: 'social-media', name: 'Social Profile & Cover', description: 'Avatar + banner preview', width: 1200, height: 900, placement: { x: 220, y: 340, maxW: 180, maxH: 180, maskShape: 'circle' }, capabilities: { supportsPerspective: false, supportsMask: true, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'DIGITAL', templateKey: 'digital-ads', name: 'Digital Ad Display', description: 'Programmatic display card', width: 1200, height: 900, placement: { x: 320, y: 240, maxW: 260, maxH: 140 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'RETAIL', templateKey: 'product-displays', name: 'Countertop Product Display', description: 'POS retail stand', width: 1200, height: 900, placement: { x: 420, y: 220, maxW: 360, maxH: 180 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'RETAIL', templateKey: 'retail-shelves', name: 'Retail Shelf Header', description: 'Aisle endcap branding', width: 1200, height: 900, placement: { x: 340, y: 180, maxW: 520, maxH: 160 }, capabilities: { supportsPerspective: false, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
  { category: 'RETAIL', templateKey: 'retail-shopping-bags', name: 'Retail Tote Bag', description: 'Boutique retail bag', width: 1200, height: 900, placement: { x: 460, y: 340, maxW: 280, maxH: 220 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: false } },
  { category: 'RETAIL', templateKey: 'store-displays', name: 'In-Store Window Display', description: 'Flagship glass showcase', width: 1200, height: 900, placement: { x: 410, y: 250, maxW: 380, maxH: 220, skewDeg: -4 }, capabilities: { supportsPerspective: true, supportsMask: false, supportsDisplacement: false, supportsColorChange: true, supportsBgChange: true, supportsTextReplace: true } },
];

export class MockupLibraryService {
  async ensureBuiltinMockups() {
    for (const seed of BUILTIN_MOCKUP_TEMPLATES) {
      const existing = await prisma.mockupTemplate.findFirst({ where: { projectId: null, templateKey: seed.templateKey } });
      if (!existing) {
        await prisma.mockupTemplate.create({ data: { projectId: null, category: seed.category, templateKey: seed.templateKey, name: seed.name, description: seed.description, width: seed.width, height: seed.height, placementJson: JSON.stringify(seed.placement), capabilitiesJson: JSON.stringify(seed.capabilities) } });
      }
    }
  }
  async listMockupTemplates(projectId: string, filters?: { category?: string; search?: string; favoritesOnly?: boolean }) {
    await this.ensureBuiltinMockups();
    return prisma.mockupTemplate.findMany({
      where: {
        OR: [{ projectId: null }, { projectId }],
        ...(filters?.category && filters.category !== 'ALL' ? { category: filters.category } : {}),
        ...(filters?.favoritesOnly ? { isFavorite: true } : {}),
        ...(filters?.search?.trim() ? { OR: [{ name: { contains: filters.search.trim() } }, { description: { contains: filters.search.trim() } }] } : {}),
      },
      orderBy: [{ isFavorite: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
  }
  async toggleTemplateFavorite(templateId: string) {
    const tpl = await prisma.mockupTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) return null;
    return prisma.mockupTemplate.update({ where: { id: templateId }, data: { isFavorite: !tpl.isFavorite } });
  }
}
