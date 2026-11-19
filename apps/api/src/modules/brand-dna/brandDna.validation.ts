import { z } from 'zod';

export const analyzeProjectLogoSchema = z.object({
  logoId: z.string().min(1).optional(),
  provider: z.enum(['heuristic', 'local-ollama', 'local-openai', 'cloud-openai', 'cloud-gemini']).optional(),
});

export const updateBrandColorSchema = z.object({
  id: z.string().min(1).optional(),
  role: z.enum(['PRIMARY', 'SECONDARY', 'ACCENT', 'NEUTRAL_LIGHT', 'NEUTRAL_DARK', 'BG_LIGHT', 'BG_DARK']),
  name: z.string().trim().max(80).optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'HEX must be #RRGGBB'),
});

export const updateBrandDnaSchema = z.object({
  brandName: z.string().trim().min(1).max(120).optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  brandDescription: z.string().trim().max(2000).nullable().optional(),
  visualDirection: z.string().trim().max(1000).nullable().optional(),
  designRules: z.array(z.string().trim().min(1)).optional(),
  colors: z.array(updateBrandColorSchema).optional(),
  typography: z.object({
    headingFont: z.string().trim().min(1).max(100).optional(),
    bodyFont: z.string().trim().min(1).max(100).optional(),
    headingFallback: z.string().trim().max(120).optional(),
    bodyFallback: z.string().trim().max(120).optional(),
    detectedStyle: z.string().trim().max(50).optional(),
  }).optional(),
  personality: z.object({
    personalityTraits: z.array(z.string().trim().min(1)).optional(),
    visualStyle: z.string().trim().min(1).max(500).optional(),
    targetAudience: z.string().trim().min(1).max(500).optional(),
    industry: z.string().trim().min(1).max(120).optional(),
    brandPositioning: z.string().trim().min(1).max(1000).optional(),
    brandTone: z.string().trim().min(1).max(300).optional(),
    designRecommendations: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
});

export type AnalyzeProjectLogoDto = z.infer<typeof analyzeProjectLogoSchema>;
export type UpdateBrandDnaDto = z.infer<typeof updateBrandDnaSchema>;
