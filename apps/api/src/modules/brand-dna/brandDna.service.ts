import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { AiProviderManager } from '../ai/provider.adapter';
import { buildBrandColorPalette, formatColorStrings, hexToRgb } from '../analyzer/color.extractor';
import { analyzeLogoBuffer } from '../analyzer/logo.analyzer';
import { analyzeTypography } from '../analyzer/typography.analyzer';
import type { AnalyzeProjectLogoDto, UpdateBrandDnaDto } from './brandDna.validation';

const storage = new LocalStorageService(env.storageRoot);
const aiManager = new AiProviderManager();

export class BrandDnaService {
  async analyzeAndBuildBrandDna(projectId: string, dto: AnalyzeProjectLogoDto) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { logos: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] } },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${projectId}" not found.`);

    const targetLogo = dto.logoId ? project.logos.find((l) => l.id === dto.logoId) : project.logos[0];
    if (!targetLogo) throw new AppError(400, 'NO_LOGO_FOUND', 'Upload an original logo before running Brand DNA analysis.');

    const buffer = await storage.readLogo(targetLogo.storagePath);
    const logoAnalysis = await analyzeLogoBuffer(buffer, targetLogo.mimeType);
    const palette = buildBrandColorPalette(logoAnalysis.extractedColors, logoAnalysis.backgroundType);
    const typography = await analyzeTypography(buffer, targetLogo.mimeType, logoAnalysis);
    const personality = await aiManager.generatePersonality({
      brandName: project.name, industry: project.industry, description: project.description, logoAnalysis, palette, typography,
    }, dto.provider);

    const latestVersionAgg = await prisma.brandDna.aggregate({ where: { projectId }, _max: { version: true } });
    const nextVersion = (latestVersionAgg._max.version || 0) + 1;

    return prisma.$transaction(async (tx) => {
      if (targetLogo.width === null || targetLogo.height === null) {
        await tx.logoAsset.update({ where: { id: targetLogo.id }, data: { width: logoAnalysis.width, height: logoAnalysis.height } });
      }
      const analysisRecord = await tx.brandAnalysis.create({
        data: {
          projectId, logoId: targetLogo.id, format: logoAnalysis.format, width: logoAnalysis.width, height: logoAnalysis.height,
          aspectRatio: logoAnalysis.aspectRatio, aspectLabel: logoAnalysis.aspectLabel, hasTransparency: logoAnalysis.hasTransparency,
          transparencyRatio: logoAnalysis.transparencyRatio, backgroundType: logoAnalysis.backgroundType, backgroundHex: logoAnalysis.backgroundHex,
          isMonochrome: logoAnalysis.isMonochrome, colorCount: logoAnalysis.colorCount, shapeStyle: logoAnalysis.shapeStyle,
          visualElementsJson: JSON.stringify(logoAnalysis.visualElements), extractedText: typography.extractedText,
          hasText: typography.hasText, ocrConfidence: typography.ocrConfidence, rawAnalysisJson: JSON.stringify({ logoAnalysis, palette, typography }),
        },
      });
      const brandDna = await tx.brandDna.create({
        data: {
          projectId, analysisId: analysisRecord.id, version: nextVersion, brandName: project.name,
          industry: personality.industry, brandDescription: project.description || personality.brandPositioning,
          logoCharacteristicsJson: JSON.stringify({
            format: logoAnalysis.format, dimensions: `${logoAnalysis.width}x${logoAnalysis.height}`,
            aspectRatio: logoAnalysis.aspectRatio, aspectLabel: logoAnalysis.aspectLabel,
            hasTransparency: logoAnalysis.hasTransparency, backgroundType: logoAnalysis.backgroundType,
            isMonochrome: logoAnalysis.isMonochrome, shapeStyle: logoAnalysis.shapeStyle, visualElements: logoAnalysis.visualElements,
          }),
          visualDirection: personality.visualDirection, designRulesJson: JSON.stringify(personality.designRules),
          status: 'DRAFT', isApproved: false,
          colors: { create: palette.map((c, idx) => ({ role: c.role, name: c.name, hex: c.hex, rgb: c.rgb, hsl: c.hsl, dominance: c.dominance, sortOrder: idx })) },
          typography: {
            create: {
              extractedText: typography.extractedText, detectedStyle: typography.detectedStyle,
              identificationConfidence: typography.identificationConfidence, confidenceNote: typography.confidenceNote,
              headingFont: typography.headingFont, bodyFont: typography.bodyFont,
              headingFallback: typography.headingFallback, bodyFallback: typography.bodyFallback,
              recommendationsJson: JSON.stringify(typography.recommendations),
            },
          },
          personality: {
            create: {
              personalityTraitsJson: JSON.stringify(personality.personalityTraits), visualStyle: personality.visualStyle,
              targetAudience: personality.targetAudience, industry: personality.industry,
              brandPositioning: personality.brandPositioning, brandTone: personality.brandTone,
              designRecommendationsJson: JSON.stringify(personality.designRecommendations),
              providerType: personality.providerType, modelName: personality.modelName,
            },
          },
        },
        include: { colors: { orderBy: { sortOrder: 'asc' } }, typography: true, personality: true, analysis: true },
      });
      return { analysis: analysisRecord, brandDna };
    });
  }

  async getProjectBrandDnas(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${projectId}" not found.`);
    const versions = await prisma.brandDna.findMany({
      where: { projectId },
      include: { colors: { orderBy: { sortOrder: 'asc' } }, typography: true, personality: true, analysis: true },
      orderBy: { version: 'desc' },
    });
    const latestAnalysis = await prisma.brandAnalysis.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return { versions, latestAnalysis };
  }

  async updateBrandDna(projectId: string, dnaId: string, dto: UpdateBrandDnaDto) {
    const existing = await prisma.brandDna.findFirst({ where: { id: dnaId, projectId }, include: { colors: true, typography: true, personality: true } });
    if (!existing) throw new AppError(404, 'BRAND_DNA_NOT_FOUND', `Brand DNA "${dnaId}" not found.`);
    return prisma.$transaction(async (tx) => {
      await tx.brandDna.update({
        where: { id: dnaId },
        data: {
          ...(dto.brandName !== undefined ? { brandName: dto.brandName } : {}),
          ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
          ...(dto.brandDescription !== undefined ? { brandDescription: dto.brandDescription } : {}),
          ...(dto.visualDirection !== undefined ? { visualDirection: dto.visualDirection } : {}),
          ...(dto.designRules !== undefined ? { designRulesJson: JSON.stringify(dto.designRules) } : {}),
        },
      });
      if (dto.colors) {
        for (const color of dto.colors) {
          const rgbObj = hexToRgb(color.hex);
          if (!rgbObj) continue;
          const formatted = formatColorStrings(rgbObj.r, rgbObj.g, rgbObj.b);
          if (color.id) {
            await tx.brandColor.updateMany({ where: { id: color.id, brandDnaId: dnaId }, data: { role: color.role, ...(color.name !== undefined ? { name: color.name } : {}), hex: formatted.hex, rgb: formatted.rgb, hsl: formatted.hsl, isEdited: true } });
          } else {
            await tx.brandColor.create({ data: { brandDnaId: dnaId, role: color.role, name: color.name || color.role, hex: formatted.hex, rgb: formatted.rgb, hsl: formatted.hsl, isEdited: true } });
          }
        }
      }
      if (dto.typography && existing.typography) {
        await tx.brandTypography.update({
          where: { brandDnaId: dnaId },
          data: {
            ...(dto.typography.headingFont !== undefined ? { headingFont: dto.typography.headingFont } : {}),
            ...(dto.typography.bodyFont !== undefined ? { bodyFont: dto.typography.bodyFont } : {}),
            ...(dto.typography.headingFallback !== undefined ? { headingFallback: dto.typography.headingFallback } : {}),
            ...(dto.typography.bodyFallback !== undefined ? { bodyFallback: dto.typography.bodyFallback } : {}),
            ...(dto.typography.detectedStyle !== undefined ? { detectedStyle: dto.typography.detectedStyle } : {}),
            isManualOverride: true,
          },
        });
      }
      if (dto.personality && existing.personality) {
        await tx.brandPersonality.update({
          where: { brandDnaId: dnaId },
          data: {
            ...(dto.personality.personalityTraits !== undefined ? { personalityTraitsJson: JSON.stringify(dto.personality.personalityTraits) } : {}),
            ...(dto.personality.visualStyle !== undefined ? { visualStyle: dto.personality.visualStyle } : {}),
            ...(dto.personality.targetAudience !== undefined ? { targetAudience: dto.personality.targetAudience } : {}),
            ...(dto.personality.industry !== undefined ? { industry: dto.personality.industry } : {}),
            ...(dto.personality.brandPositioning !== undefined ? { brandPositioning: dto.personality.brandPositioning } : {}),
            ...(dto.personality.brandTone !== undefined ? { brandTone: dto.personality.brandTone } : {}),
            ...(dto.personality.designRecommendations !== undefined ? { designRecommendationsJson: JSON.stringify(dto.personality.designRecommendations) } : {}),
            isEdited: true,
          },
        });
      }
      return tx.brandDna.findUnique({ where: { id: dnaId }, include: { colors: { orderBy: { sortOrder: 'asc' } }, typography: true, personality: true, analysis: true } });
    });
  }

  async approveBrandDna(projectId: string, dnaId: string) {
    const existing = await prisma.brandDna.findFirst({ where: { id: dnaId, projectId } });
    if (!existing) throw new AppError(404, 'BRAND_DNA_NOT_FOUND', `Brand DNA "${dnaId}" not found.`);
    return prisma.$transaction(async (tx) => {
      await tx.brandDna.updateMany({ where: { projectId, status: 'APPROVED', NOT: { id: dnaId } }, data: { status: 'SUPERSEDED', isApproved: false } });
      return tx.brandDna.update({ where: { id: dnaId }, data: { status: 'APPROVED', isApproved: true, approvedAt: new Date() }, include: { colors: { orderBy: { sortOrder: 'asc' } }, typography: true, personality: true, analysis: true } });
    });
  }
}
