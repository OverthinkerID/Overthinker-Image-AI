import { env } from '../../config/appConfig';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { GeminiCloudAdapter, OpenAiCloudAdapter } from '../ai/cloud.adapter';
import { UsageService } from '../usage/usage.service';

export interface ModelCapability {
  provider: string;
  model: string;
  supportsText: boolean;
  supportsVision: boolean;
  isLocal: boolean;
}

const CAPABILITY_REGISTRY: ModelCapability[] = [
  { provider: 'heuristic', model: 'creative-director-deterministic-v1', supportsText: true, supportsVision: true, isLocal: true },
  { provider: 'local-ollama', model: env.ai.ollamaModel, supportsText: true, supportsVision: /llava|vision|llama3\.2-vision|qwen2\.5vl/i.test(env.ai.ollamaModel), isLocal: true },
  { provider: 'cloud-openai', model: env.ai.openAiModel, supportsText: true, supportsVision: /4o|gpt-4\.1|vision/i.test(env.ai.openAiModel), isLocal: false },
  { provider: 'cloud-gemini', model: env.ai.geminiModel, supportsText: true, supportsVision: /gemini/i.test(env.ai.geminiModel), isLocal: false },
];

const usageService = new UsageService();

export class DirectorAiAdapter {
  private readonly openAi = new OpenAiCloudAdapter();
  private readonly gemini = new GeminiCloudAdapter();

  listCapabilities(customModel?: string): ModelCapability[] {
    if (!customModel) return CAPABILITY_REGISTRY;
    return CAPABILITY_REGISTRY.map((c) => ({
      ...c,
      supportsVision: c.provider === 'local-ollama' ? /llava|vision|llama3\.2-vision|qwen2\.5vl/i.test(customModel) : c.supportsVision,
    }));
  }

  supportsVision(provider: string, model?: string): boolean {
    if (provider === 'heuristic') return true;
    const m = model || CAPABILITY_REGISTRY.find((c) => c.provider === provider)?.model || '';
    if (provider === 'local-ollama') return /llava|vision|llama3\.2-vision|qwen2\.5vl/i.test(m);
    if (provider === 'cloud-openai') return /4o|gpt-4\.1|vision/i.test(m);
    if (provider === 'cloud-gemini') return /gemini/i.test(m);
    return false;
  }

  private async checkWorkspacePrivacy(workspaceId: string, provider: string, allowCloudUpload?: boolean) {
    const isCloud = provider.startsWith('cloud-');
    if (!isCloud) return;
    const settings = await prisma.workspaceSetting.findUnique({ where: { workspaceId } });
    if (settings?.aiMode === 'LOCAL_ONLY') {
      throw new AppError(403, 'CLOUD_BLOCKED_BY_WORKSPACE_POLICY', 'Workspace AI mode is set to LOCAL_ONLY. Cloud providers are blocked.');
    }
    if (!allowCloudUpload) {
      throw new AppError(403, 'CLOUD_UPLOAD_CONSENT_REQUIRED', 'Explicit cloud upload permission (allowCloudUpload=true) is required before sending client assets to cloud AI.');
    }
  }

  async reasonText(params: {
    workspaceId: string;
    projectId: string;
    userId?: string;
    provider?: string;
    model?: string;
    systemPrompt: string;
    prompt: string;
    allowCloudUpload?: boolean;
    fallbackText: () => string;
  }): Promise<{ text: string; provider: string; model: string; fallbackUsed: boolean; errorNote?: string }> {
    const provider = params.provider || 'heuristic';
    await this.checkWorkspacePrivacy(params.workspaceId, provider, params.allowCloudUpload);

    if (provider === 'heuristic') {
      await usageService.recordUsage({ workspaceId: params.workspaceId, projectId: params.projectId, userId: params.userId, metric: 'LOCAL_AI_CALL', provider: 'heuristic' });
      return { text: params.fallbackText(), provider: 'heuristic', model: 'creative-director-deterministic-v1', fallbackUsed: false };
    }

    try {
      let result: { text: string; model: string };
      if (provider === 'local-ollama') {
        const model = params.model || env.ai.ollamaModel;
        const res = await fetch(`${env.ai.ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: `${params.systemPrompt}\n\n${params.prompt}`, stream: false }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = (await res.json()) as { response?: string };
        result = { text: data.response || '', model };
        await usageService.recordUsage({ workspaceId: params.workspaceId, projectId: params.projectId, userId: params.userId, metric: 'LOCAL_AI_CALL', provider });
      } else if (provider === 'cloud-openai') {
        result = await this.openAi.generateText({ prompt: params.prompt, systemPrompt: params.systemPrompt, model: params.model });
        await usageService.recordUsage({ workspaceId: params.workspaceId, projectId: params.projectId, userId: params.userId, metric: 'CLOUD_API_CALL', provider });
      } else if (provider === 'cloud-gemini') {
        result = await this.gemini.generateText({ prompt: params.prompt, systemPrompt: params.systemPrompt, model: params.model });
        await usageService.recordUsage({ workspaceId: params.workspaceId, projectId: params.projectId, userId: params.userId, metric: 'CLOUD_API_CALL', provider });
      } else {
        throw new Error(`Unsupported provider "${provider}"`);
      }

      await usageService.recordUsage({ workspaceId: params.workspaceId, projectId: params.projectId, userId: params.userId, metric: 'AI_TEXT_GEN', provider });
      return { text: result.text, provider, model: result.model, fallbackUsed: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provider call failed';
      return { text: params.fallbackText(), provider: 'heuristic', model: 'creative-director-deterministic-v1', fallbackUsed: true, errorNote: msg };
    }
  }

  async analyzeVision(params: {
    workspaceId: string;
    projectId: string;
    userId?: string;
    provider?: string;
    model?: string;
    prompt: string;
    imageBuffer: Buffer;
    mimeType: string;
    allowCloudUpload?: boolean;
    fallbackSummary: () => string;
  }): Promise<{ text: string; provider: string; model: string; fallbackUsed: boolean; errorNote?: string }> {
    const provider = params.provider || 'heuristic';
    await this.checkWorkspacePrivacy(params.workspaceId, provider, params.allowCloudUpload);

    if (provider !== 'heuristic' && !this.supportsVision(provider, params.model)) {
      throw new AppError(400, 'VISION_UNSUPPORTED_MODEL', `Selected model for "${provider}" does not support image/vision input.`);
    }

    if (provider === 'heuristic') {
      return { text: params.fallbackSummary(), provider: 'heuristic', model: 'sharp-vision-inspector-v1', fallbackUsed: false };
    }

    try {
      let result: { text: string; model: string };
      if (provider === 'local-ollama') {
        const model = params.model || 'llava:latest';
        const res = await fetch(`${env.ai.ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: params.prompt, images: [params.imageBuffer.toString('base64')], stream: false }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Ollama Vision HTTP ${res.status}`);
        const data = (await res.json()) as { response?: string };
        result = { text: data.response || '', model };
      } else if (provider === 'cloud-openai') {
        result = await this.openAi.analyzeVision({ prompt: params.prompt, imageBuffer: params.imageBuffer, mimeType: params.mimeType, model: params.model });
      } else if (provider === 'cloud-gemini') {
        result = await this.gemini.analyzeVision({ prompt: params.prompt, imageBuffer: params.imageBuffer, mimeType: params.mimeType, model: params.model });
      } else {
        throw new Error(`Unsupported vision provider "${provider}"`);
      }
      return { text: result.text, provider, model: result.model, fallbackUsed: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vision provider failed';
      return { text: params.fallbackSummary(), provider: 'heuristic', model: 'sharp-vision-inspector-v1', fallbackUsed: true, errorNote: msg };
    }
  }
}
