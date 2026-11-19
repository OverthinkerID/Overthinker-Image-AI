export interface ScoringCategoryInput {
  categoryKey: string;
  label: string;
  score: number;
  judgmentType: 'DETERMINISTIC' | 'AI_SUBJECTIVE';
  explanation: string;
  confidence: number;
  severity: 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  recommendation: string;
  weight?: number;
}

export interface EvidenceInput {
  categoryKey: string;
  sourceType: 'IMAGE_PROCESSING' | 'DESIGN_JSON' | 'BRAND_DNA' | 'VISION_AI';
  assetId?: string;
  assetVersion?: number;
  measurement: Record<string, unknown>;
  finding: string;
}

export const DEFAULT_SCORING_CRITERIA = {
  version: 'cd-scoring-v1.0',
  minCategoriesForOverall: 3,
  minEvidenceForOverall: 1,
  disclaimer:
    'Advisory creative assessment only. Scores are not objective guarantees, do not predict commercial success, and do not guarantee trademark or legal availability.',
  weights: {
    scalability: 1.2,
    readability: 1.2,
    contrast: 1.15,
    versatility: 1.1,
    brand_alignment: 1.15,
    visual_balance: 1.0,
    reproduction_quality: 1.1,
    distinctiveness: 0.9,
    recognition: 0.9,
    memorability: 0.9,
  } as Record<string, number>,
};

export function clampScore(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function computeOverallAdvisoryScore(
  categories: ScoringCategoryInput[],
  evidence: EvidenceInput[],
  customWeights?: Record<string, number>
): number | null {
  if (
    categories.length < DEFAULT_SCORING_CRITERIA.minCategoriesForOverall ||
    evidence.length < DEFAULT_SCORING_CRITERIA.minEvidenceForOverall
  ) {
    return null;
  }
  const weights = { ...DEFAULT_SCORING_CRITERIA.weights, ...(customWeights || {}) };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of categories) {
    const w = c.weight ?? weights[c.categoryKey] ?? 1.0;
    weightedSum += clampScore(c.score) * w;
    totalWeight += w;
  }
  if (totalWeight <= 0) return null;
  return clampScore(weightedSum / totalWeight);
}
