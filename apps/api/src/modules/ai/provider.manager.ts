import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { GeminiCloudAdapter, OpenAiCloudAdapter } from './cloud.adapter';
import { ComfyUiService } from './comfyui.service';

export type AiExecutionMode = 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'HYBRID';

export interface SafeProviderView {
  id: string; name: string; mode: string; providerType: string; baseUrl: string | null;
  defaultModel: string | null; hasApiKey: boolean; settings: Record<string, unknown>;
  isActive: boolean; healthStatus: string; lastCheckedAt: Date | null;
}

export class AiProviderManager {
  private readonly comfy = new ComfyUiService();
  private readonly openAi = new OpenAiCloudAdapter();
  private readonly gemini = new GeminiCloudAdapter();

  async ensureDefaultProviders() {
    const defaults = [
      { name: 'Local ComfyUI Studio', mode: env.ai.mode, providerType: 'comfyui', baseUrl: env.ai.comfyUiBaseUrl, defaultModel: env.ai.comfyUiDefaultModel, apiKeyRef: null, hasApiKey: false, settingsJson: JSON.stringify({ steps: 24, cfg: 7.0, width: 1024, height: 1024 }) },
      { name: 'Local Ollama LLM', mode: env.ai.mode, providerType: 'local-ollama', baseUrl: env.ai.ollamaBaseUrl, defaultModel: env.ai.ollamaModel, apiKeyRef: null, hasApiKey: false, settingsJson: JSON.stringify({ temperature: 0.5 }) },
      { name: 'Cloud OpenAI', mode: env.ai.mode, providerType: 'cloud-openai', baseUrl: 'https://api.openai.com/v1', defaultModel: env.ai.openAiModel, apiKeyRef: 'OPENAI_API_KEY', hasApiKey: this.openAi.isConfigured(), settingsJson: JSON.stringify({ temperature: 0.6, imageModel: env.ai.openAiImageModel }) },
      { name: 'Cloud Gemini', mode: env.ai.mode, providerType: 'cloud-gemini', baseUrl: 'https://generativelanguage.googleapis.com', defaultModel: env.ai.geminiModel, apiKeyRef: 'GEMINI_API_KEY', hasApiKey: this.gemini.isConfigured(), settingsJson: JSON.stringify({ temperature: 0.6 }) },
    ];
    for (const p of defaults) await prisma.aiProviderConfig.upsert({ where: { providerType: p.providerType }, update: { hasApiKey: p.hasApiKey }, create: p });
    await this.comfy.ensureDefaultWorkflows();
  }

  async listProviders(): Promise<SafeProviderView[]> {
    await this.ensureDefaultProviders();
    const rows = await prisma.aiProviderConfig.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({ id: r.id, name: r.name, mode: r.mode, providerType: r.providerType, baseUrl: r.baseUrl, defaultModel: r.defaultModel, hasApiKey: r.hasApiKey, settings: JSON.parse(r.settingsJson || '{}'), isActive: r.isActive, healthStatus: r.healthStatus, lastCheckedAt: r.lastCheckedAt }));
  }

  async updateProviderConfig(providerType: string, updates: { mode?: AiExecutionMode; baseUrl?: string | null; defaultModel?: string | null; isActive?: boolean; settings?: Record<string, unknown> }) {
    await this.ensureDefaultProviders();
    const updated = await prisma.aiProviderConfig.update({
      where: { providerType },
      data: { ...(updates.mode ? { mode: updates.mode } : {}), ...(updates.baseUrl !== undefined ? { baseUrl: updates.baseUrl } : {}), ...(updates.defaultModel !== undefined ? { defaultModel: updates.defaultModel } : {}), ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}), ...(updates.settings ? { settingsJson: JSON.stringify(updates.settings) } : {}) },
    });
    return { id: updated.id, name: updated.name, mode: updated.mode, providerType: updated.providerType, baseUrl: updated.baseUrl, defaultModel: updated.defaultModel, hasApiKey: updated.hasApiKey, settings: JSON.parse(updated.settingsJson || '{}'), isActive: updated.isActive, healthStatus: updated.healthStatus, lastCheckedAt: updated.lastCheckedAt };
  }

  async testConnection(providerType: string) {
    await this.ensureDefaultProviders();
    const cfg = await prisma.aiProviderConfig.findUnique({ where: { providerType } });
    let result: { ok: boolean; latencyMs: number; message: string; models?: string[] } = { ok: false, latencyMs: 0, message: `Unknown provider: ${providerType}` };
    if (providerType === 'comfyui') result = await new ComfyUiService(cfg?.baseUrl || env.ai.comfyUiBaseUrl).testConnection();
    else if (providerType === 'local-ollama') {
      const start = Date.now();
      try {
        const res = await fetch(`${(cfg?.baseUrl || env.ai.ollamaBaseUrl).replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(4000) });
        result = { ok: res.ok, latencyMs: Date.now() - start, message: res.ok ? 'Connected to local Ollama.' : `Ollama returned HTTP ${res.status}` };
      } catch (err) { result = { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'Ollama unreachable' }; }
    } else if (providerType === 'cloud-openai') result = await this.openAi.testConnection();
    else if (providerType === 'cloud-gemini') result = await this.gemini.testConnection();
    await prisma.aiProviderConfig.update({ where: { providerType }, data: { healthStatus: result.ok ? 'HEALTHY' : 'UNREACHABLE', lastCheckedAt: new Date() } });
    return { providerType, ...result };
  }
}
