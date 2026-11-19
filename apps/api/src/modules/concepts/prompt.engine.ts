export type ConceptCategoryKey =
  | 'ORIGINAL_EVOLUTION'
  | 'PREMIUM_LUXURY'
  | 'MODERN_MINIMALIST'
  | 'CREATIVE_FUTURISTIC';

export interface BrandDnaPromptContext {
  brandName: string; industry: string; personalityTraits: string[]; visualStyle: string;
  visualDirection: string; colors: Array<{ role: string; hex: string }>;
  headingFont: string; bodyFont: string; targetAudience: string; designRules: string[];
}

export interface CategoryPromptSpec {
  categoryKey: ConceptCategoryKey; conceptName: string; prompt: string; negativePrompt: string;
}

export const CONCEPT_CATEGORIES: ConceptCategoryKey[] = [
  'ORIGINAL_EVOLUTION', 'PREMIUM_LUXURY', 'MODERN_MINIMALIST', 'CREATIVE_FUTURISTIC',
];

export function buildCategoryPrompt(ctx: BrandDnaPromptContext, categoryKey: ConceptCategoryKey): CategoryPromptSpec {
  const primary = ctx.colors.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
  const secondary = ctx.colors.find((c) => c.role === 'SECONDARY')?.hex || '#1E293B';
  const accent = ctx.colors.find((c) => c.role === 'ACCENT')?.hex || '#38BDF8';
  const traits = ctx.personalityTraits.join(', ') || 'distinctive, modern';
  const constraints = ctx.designRules.slice(0, 3).join('; ') || 'preserve master logo proportions';

  const baseVariables = [
    `Brand: "${ctx.brandName}"`, `Industry: ${ctx.industry}`, `Personality: ${traits}`,
    `Audience: ${ctx.targetAudience}`, `Core Colors: ${primary}, ${secondary}, ${accent}`,
    `Typography Direction: ${ctx.headingFont} + ${ctx.bodyFont}`, `Design Constraints: ${constraints}`,
  ].join(' | ');
  const negativePrompt = 'blurry, distorted logo, cluttered background, watermark, unreadable gibberish text, low resolution';

  switch (categoryKey) {
    case 'ORIGINAL_EVOLUTION':
      return { categoryKey, conceptName: 'Original Evolution', prompt: `Refined brand identity moodboard and stationery mockup for ${baseVariables}. Evolve the existing visual direction (${ctx.visualDirection}) while preserving the original mark integrity.`, negativePrompt };
    case 'PREMIUM_LUXURY':
      return { categoryKey, conceptName: 'Premium Luxury', prompt: `High-end editorial luxury brand identity presentation for ${baseVariables}. Tactile dark slate and warm metallic accents, embossed packaging, timeless prestige aesthetic.`, negativePrompt };
    case 'MODERN_MINIMALIST':
      return { categoryKey, conceptName: 'Modern Minimalist', prompt: `Swiss-inspired modern minimalist brand system for ${baseVariables}. Crisp geometric grid, generous negative space, high-contrast monochrome + ${primary} anchor.`, negativePrompt };
    case 'CREATIVE_FUTURISTIC':
      return { categoryKey, conceptName: 'Creative Futuristic', prompt: `Forward-looking creative futuristic brand identity for ${baseVariables}. Dynamic spatial gradients using ${primary} and ${accent}, kinetic modular geometry, glassmorphic surfaces.`, negativePrompt };
  }
}
