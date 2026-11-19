import { env } from '../../config/appConfig';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { GeminiCloudAdapter, OpenAiCloudAdapter } from '../ai/cloud.adapter';

export interface StrategyAiCapability {
  provider: string;
  model: string;
  textGeneration: boolean;
  structuredOutput: boolean;
  longContext: boolean;
  webResearch: boolean;
  visionAnalysis: boolean;
  isLocal: boolean;
}

export interface ExternalWebResearchAdapter {
  isConfigured(): boolean;
  getStatus(): { configured: boolean; status: string };
  search(query: string): Promise<Array<{ title: string; url: string; publisher?: string; publishedAt?: string; excerpt?: string }>>;
}

export interface ExternalDomainCheckAdapter {
  isConfigured(): boolean;
  getStatus(): { configured: boolean; status: string };
  checkDomain(domain: string): Promise<{ domain: string; status: string }>;
}

export class ConfigurableWebResearchAdapter implements ExternalWebResearchAdapter {
  private readonly endpoint = process.env.WEB_RESEARCH_PROVIDER_URL || '';
  private readonly apiKey = process.env.WEB_RESEARCH_API_KEY || '';

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      status: this.isConfigured() ? 'CONFIGURED' : 'EXTERNAL_PROVIDER_NOT_CONFIGURED',
    };
  }

  async search(query: string) {
    if (!this.isConfigured()) return [];
    const res = await fetch(`${this.endpoint}?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<{ title: string; url: string; publisher?: string; publishedAt?: string; excerpt?: string }> };
    return data.results || [];
  }
}

export class ConfigurableDomainCheckAdapter implements ExternalDomainCheckAdapter {
  private readonly endpoint = process.env.DOMAIN_CHECK_API_URL || '';
  private readonly apiKey = process.env.DOMAIN_CHECK_API_KEY || '';

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      status: this.isConfigured() ? 'CONFIGURED' : 'EXTERNAL_PROVIDER_NOT_CONFIGURED',
    };
  }

  async checkDomain(domain: string) {
    if (!this.isConfigured()) {
      return { domain, status: 'EXTERNAL_PROVIDER_NOT_CONFIGURED' };
    }
    try {
      const res = await fetch(`${this.endpoint}?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { domain, status: 'CHECK_FAILED' };
      const data = (await res.json()) as { available?: boolean };
      return { domain, status: data.available ? 'INDICATIVE_AVAILABLE' : 'REGISTERED' };
    } catch {
      return { domain, status: 'CHECK_FAILED' };
    }
  }
}

export class StrategyAiAdapter {
  private readonly openAi = new OpenAiCloudAdapter();
  private readonly gemini = new GeminiCloudAdapter();
  public readonly webResearch = new ConfigurableWebResearchAdapter();
  public readonly domainCheck = new ConfigurableDomainCheckAdapter();

  listCapabilities(): StrategyAiCapability[] {
    const webReady = this.webResearch.isConfigured();
    return [
      { provider: 'heuristic', model: 'strategy-deterministic-v1', textGeneration: true, structuredOutput: true, longContext: true, webResearch: webReady, visionAnalysis: false, isLocal: true },
      { provider: 'local-ollama', model: env.ai.ollamaModel, textGeneration: true, structuredOutput: true, longContext: true, webResearch: webReady, visionAnalysis: /llava|vision/i.test(env.ai.ollamaModel), isLocal: true },
      { provider: 'cloud-openai', model: env.ai.openAiModel, textGeneration: true, structuredOutput: true, longContext: true, webResearch: webReady, visionAnalysis: true, isLocal: false },
      { provider: 'cloud-gemini', model: env.ai.geminiModel, textGeneration: true, structuredOutput: true, longContext: true, webResearch: webReady, visionAnalysis: true, isLocal: false },
    ];
  }

  async checkPrivacy(workspaceId: string, provider: string, allowCloudUpload?: boolean) {
    if (!provider.startsWith('cloud-')) return;
    const settings = await prisma.workspaceSetting.findUnique({ where: { workspaceId } });
    if (settings?.aiMode === 'LOCAL_ONLY') {
      throw new AppError(403, 'CLOUD_BLOCKED_BY_WORKSPACE_POLICY', 'Workspace AI mode is LOCAL_ONLY. Cloud strategy AI is blocked.');
    }
    if (!allowCloudUpload) {
      throw new AppError(403, 'CLOUD_UPLOAD_CONSENT_REQUIRED', 'Explicit cloud upload consent (allowCloudUpload=true) is required.');
    }
  }

  async generateStructured<T>(params: {
    workspaceId: string;
    provider?: string;
    model?: string;
    systemPrompt: string;
    prompt: string;
    allowCloudUpload?: boolean;
    fallback: () => T;
  }): Promise<{ data: T; providerUsed: string; modelUsed: string; fallbackUsed: boolean }> {
    const provider = params.provider || 'heuristic';
    await this.checkPrivacy(params.workspaceId, provider, params.allowCloudUpload);

    if (provider === 'heuristic') {
      return { data: params.fallback(), providerUsed: 'heuristic', modelUsed: 'strategy-deterministic-v1', fallbackUsed: false };
    }

    try {
      let raw = '';
      let modelUsed = params.model || 'unknown';
      if (provider === 'local-ollama') {
        modelUsed = params.model || env.ai.ollamaModel;
        const res = await fetch(`${env.ai.ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelUsed, prompt: `${params.systemPrompt}\n\n${params.prompt}`, stream: false }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        raw = ((await res.json()) as { response?: string }).response || '';
      } else if (provider === 'cloud-openai') {
        const out = await this.openAi.generateText({ prompt: params.prompt, systemPrompt: params.systemPrompt, model: params.model });
        raw = out.text;
        modelUsed = out.model;
      } else if (provider === 'cloud-gemini') {
        const out = await this.gemini.generateText({ prompt: params.prompt, systemPrompt: params.systemPrompt, model: params.model });
        raw = out.text;
        modelUsed = out.model;
      }
      const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        return { data: JSON.parse(match[0]) as T, providerUsed: provider, modelUsed, fallbackUsed: false };
      }
    } catch {
      // Safe fallback without corrupting project data
    }
    return { data: params.fallback(), providerUsed: 'heuristic', modelUsed: 'strategy-deterministic-v1', fallbackUsed: true };
  }
}
