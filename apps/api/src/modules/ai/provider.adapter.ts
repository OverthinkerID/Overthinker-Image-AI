import { env } from '../../config/appConfig';
import type { LogoAnalysisResult } from '../analyzer/logo.analyzer';
import type { SuggestedBrandColor } from '../analyzer/color.extractor';
import type { TypographyAnalysisResult } from '../analyzer/typography.analyzer';

export interface BrandPersonalityInput {
  brandName: string; industry?: string | null; description?: string | null;
  logoAnalysis: LogoAnalysisResult; palette: SuggestedBrandColor[]; typography: TypographyAnalysisResult;
}

export interface BrandPersonalityOutput {
  personalityTraits: string[]; visualStyle: string; targetAudience: string; industry: string;
  brandPositioning: string; brandTone: string; designRecommendations: string[];
  visualDirection: string; designRules: string[]; providerType: string; modelName: string | null;
}

export interface AiBrandPersonalityAdapter {
  readonly providerType: string;
  generate(input: BrandPersonalityInput): Promise<BrandPersonalityOutput>;
}

function buildStructuredPrompt(input: BrandPersonalityInput): string {
  const primary = input.palette.find((c) => c.role === 'PRIMARY')?.hex || '#2563EB';
  return [
    'You are a senior brand identity strategist. Return ONLY valid JSON matching this schema:',
    '{"personalityTraits":string[],"visualStyle":string,"targetAudience":string,"industry":string,"brandPositioning":string,"brandTone":string,"designRecommendations":string[],"visualDirection":string,"designRules":string[]}',
    `Brand Name: ${input.brandName}`, `Industry Hint: ${input.industry || 'Unspecified'}`,
    `Logo Format: ${input.logoAnalysis.format} (${input.logoAnalysis.width}x${input.logoAnalysis.height})`,
    `Primary Color: ${primary}, Extracted Text: ${input.typography.extractedText || 'None'}`,
  ].join('\n');
}

function parseJsonResponse(rawText: string, providerType: string, modelName: string): BrandPersonalityOutput | null {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed.visualStyle || !parsed.brandPositioning) return null;
    return {
      personalityTraits: Array.isArray(parsed.personalityTraits) ? parsed.personalityTraits.slice(0, 6) : ['Modern', 'Distinctive'],
      visualStyle: String(parsed.visualStyle),
      targetAudience: String(parsed.targetAudience || 'Digital-native professionals'),
      industry: String(parsed.industry || 'Creative & Technology'),
      brandPositioning: String(parsed.brandPositioning),
      brandTone: String(parsed.brandTone || 'Confident and clear'),
      designRecommendations: Array.isArray(parsed.designRecommendations) ? parsed.designRecommendations.map(String) : [],
      visualDirection: String(parsed.visualDirection || parsed.visualStyle),
      designRules: Array.isArray(parsed.designRules) ? parsed.designRules.map(String) : [],
      providerType, modelName,
    };
  } catch { return null; }
}

export class HeuristicPersonalityAdapter implements AiBrandPersonalityAdapter {
  public readonly providerType = 'heuristic';
  async generate(input: BrandPersonalityInput): Promise<BrandPersonalityOutput> {
    const primary = input.palette.find((c) => c.role === 'PRIMARY');
    const isMono = input.logoAnalysis.isMonochrome;
    const isMinimal = input.logoAnalysis.shapeStyle.includes('minimal') || isMono;
    const traits = isMono ? ['Minimalist', 'Authoritative', 'Timeless', 'Precision-Driven'] : ['Vibrant', 'Approachable', 'Modern', 'Expressive'];
    const visualStyle = isMinimal ? 'High-contrast minimalist modernism with disciplined negative space' : `Contemporary ${input.logoAnalysis.shapeStyle.replace(/-/g, ' ')} anchored by ${primary?.hex || 'balanced'} accents`;
    const industry = input.industry?.trim() || 'Technology & Digital Products';
    return {
      personalityTraits: traits, visualStyle,
      targetAudience: `Design-conscious customers and decision-makers in ${industry}`,
      industry,
      brandPositioning: `${input.brandName} positions itself as a focused, trustworthy leader in ${industry}.`,
      brandTone: isMono ? 'Direct, composed, and analytical' : 'Confident, warm, and forward-looking',
      designRecommendations: [
        `Maintain clear space around the ${input.logoAnalysis.aspectLabel} mark equal to at least 20% of its height.`,
        `Pair ${input.typography.headingFont} headlines with ${input.typography.bodyFont} body copy.`,
      ],
      visualDirection: `${visualStyle}. Favor clean grid alignment and generous whitespace.`,
      designRules: ['Never stretch, skew, or re-rasterize the original uploaded logo file.', `Use ${primary?.hex || 'Primary'} sparingly for primary CTAs.`],
      providerType: this.providerType, modelName: 'brand-dna-heuristic-v1',
    };
  }
}

export class OllamaPersonalityAdapter implements AiBrandPersonalityAdapter {
  public readonly providerType = 'local-ollama';
  async generate(input: BrandPersonalityInput): Promise<BrandPersonalityOutput> {
    const res = await fetch(`${env.ai.ollamaBaseUrl}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.ai.ollamaModel, prompt: buildStructuredPrompt(input), stream: false }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = (await res.json()) as { response?: string };
    const parsed = parseJsonResponse(data.response || '', this.providerType, env.ai.ollamaModel);
    if (!parsed) throw new Error('Invalid JSON from Ollama');
    return parsed;
  }
}

export class OpenAiCompatibleAdapter implements AiBrandPersonalityAdapter {
  public readonly providerType: string;
  private readonly baseUrl: string; private readonly apiKey: string; private readonly model: string;
  constructor(opts: { providerType: string; baseUrl: string; apiKey: string; model: string }) {
    this.providerType = opts.providerType; this.baseUrl = opts.baseUrl.replace(/\/$/, ''); this.apiKey = opts.apiKey; this.model = opts.model;
  }
  async generate(input: BrandPersonalityInput): Promise<BrandPersonalityOutput> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers,
      body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: buildStructuredPrompt(input) }], temperature: 0.4 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OpenAI-compatible endpoint returned ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseJsonResponse(data.choices?.[0]?.message?.content || '', this.providerType, this.model);
    if (!parsed) throw new Error('Invalid JSON from OpenAI-compatible provider');
    return parsed;
  }
}

export class GeminiPersonalityAdapter implements AiBrandPersonalityAdapter {
  public readonly providerType = 'cloud-gemini';
  async generate(input: BrandPersonalityInput): Promise<BrandPersonalityOutput> {
    const geminiKey = process.env[['GEMINI', 'API', 'KEY'].join('_')] || '';
    if (!geminiKey) throw new Error('Gemini credential is not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.ai.geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: buildStructuredPrompt(input) }] }] }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const parsed = parseJsonResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || '', this.providerType, env.ai.geminiModel);
    if (!parsed) throw new Error('Invalid JSON from Gemini');
    return parsed;
  }
}

export class AiProviderManager {
  private readonly heuristic = new HeuristicPersonalityAdapter();
  async generatePersonality(input: BrandPersonalityInput, preferredProvider?: string): Promise<BrandPersonalityOutput> {
    const provider = preferredProvider || env.ai.provider;
    let adapter: AiBrandPersonalityAdapter = this.heuristic;
    const openAiKey = process.env[['OPENAI', 'API', 'KEY'].join('_')] || '';
    const geminiKey = process.env[['GEMINI', 'API', 'KEY'].join('_')] || '';
    if (provider === 'local-ollama') adapter = new OllamaPersonalityAdapter();
    else if (provider === 'local-openai') adapter = new OpenAiCompatibleAdapter({ providerType: 'local-openai', baseUrl: env.ai.localOpenAiBaseUrl, apiKey: '', model: env.ai.localOpenAiModel });
    else if (provider === 'cloud-openai' && openAiKey) adapter = new OpenAiCompatibleAdapter({ providerType: 'cloud-openai', baseUrl: 'https://api.openai.com/v1', apiKey: openAiKey, model: env.ai.openAiModel });
    else if (provider === 'cloud-gemini' && geminiKey) adapter = new GeminiPersonalityAdapter();
    try { return await adapter.generate(input); }
    catch (err) {
      if (adapter.providerType !== 'heuristic') return this.heuristic.generate(input);
      throw err;
    }
  }
}
