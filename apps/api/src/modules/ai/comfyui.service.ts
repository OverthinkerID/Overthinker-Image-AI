import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';

export interface ComfyWorkflowParams {
  prompt: string; negativePrompt?: string; model?: string; seed?: number;
  steps?: number; cfg?: number; width?: number; height?: number; denoise?: number; referenceImageFilename?: string;
}

const DEFAULT_CONCEPT_WORKFLOW = {
  '3': { class_type: 'KSampler', inputs: { seed: '{{seed}}', steps: '{{steps}}', cfg: '{{cfg}}', sampler_name: 'euler', scheduler: 'normal', denoise: '{{denoise}}', model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '{{model}}' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: '{{width}}', height: '{{height}}', batch_size: 1 } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: '{{negative_prompt}}', clip: ['4', 1] } },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'overthinker_concept', images: ['8', 0] } },
};

export function interpolateWorkflowTemplate(templateJson: string, params: ComfyWorkflowParams): Record<string, unknown> {
  const seed = params.seed ?? crypto.randomInt(1, 2147483647);
  const replacements: Record<string, string | number> = {
    '{{prompt}}': params.prompt, '{{negative_prompt}}': params.negativePrompt || 'blurry, low quality, distorted text, watermark',
    '{{model}}': params.model || env.ai.comfyUiDefaultModel, '{{seed}}': seed, '{{steps}}': params.steps ?? 24,
    '{{cfg}}': params.cfg ?? 7.0, '{{width}}': params.width ?? 1024, '{{height}}': params.height ?? 1024,
    '{{denoise}}': params.denoise ?? 1.0, '{{reference_image}}': params.referenceImageFilename || '',
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (node in replacements) return replacements[node];
      let out = node;
      for (const [token, val] of Object.entries(replacements)) out = out.split(token).join(String(val));
      return out;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  return walk(JSON.parse(templateJson)) as Record<string, unknown>;
}

export class ComfyUiService {
  private readonly baseUrl: string;
  constructor(baseUrl = env.ai.comfyUiBaseUrl) { this.baseUrl = baseUrl.replace(/\/$/, ''); }

  async ensureDefaultWorkflows() {
    const defaults = [
      { name: 'brand-concept-txt2img', category: 'CONCEPT_GENERATION', version: '1.0.0', description: 'Configurable text-to-image concept board workflow', workflowJson: JSON.stringify(DEFAULT_CONCEPT_WORKFLOW), defaultParamsJson: JSON.stringify({ steps: 24, cfg: 7.0, width: 1024, height: 1024, denoise: 1.0 }), isDefault: true },
      { name: 'brand-concept-ref-conditioning', category: 'REFERENCE_CONDITIONING', version: '1.0.0', description: 'Reference-conditioned brand identity exploration workflow', workflowJson: JSON.stringify(DEFAULT_CONCEPT_WORKFLOW), defaultParamsJson: JSON.stringify({ steps: 26, cfg: 6.5, width: 1024, height: 1024, denoise: 0.72 }), isDefault: false },
      { name: 'brand-image-edit', category: 'IMAGE_EDIT', version: '1.0.0', description: 'Configurable image-to-image / inpaint editing workflow', workflowJson: JSON.stringify(DEFAULT_CONCEPT_WORKFLOW), defaultParamsJson: JSON.stringify({ steps: 20, cfg: 6.5, width: 1024, height: 1024, denoise: 0.55 }), isDefault: false },
    ];
    for (const wf of defaults) await prisma.comfyWorkflowTemplate.upsert({ where: { name: wf.name }, update: {}, create: wf });
  }

  async testConnection() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { ok: false, latencyMs: Date.now() - start, message: `ComfyUI returned HTTP ${res.status}`, models: [] };
      const models = await this.listCheckpoints().catch(() => []);
      return { ok: true, latencyMs: Date.now() - start, message: 'Connected to local ComfyUI server.', models };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'ComfyUI unreachable', models: [] };
    }
  }

  async listCheckpoints(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/object_info/CheckpointLoaderSimple`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { CheckpointLoaderSimple?: { input?: { required?: { ckpt_name?: [string[]] } } } };
    return data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
  }

  async submitAndWaitForImage(params: { workflowTemplateJson: string; workflowParams: ComfyWorkflowParams; maxRetries?: number; onProgress?: (pct: number) => Promise<void> }) {
    const retries = params.maxRetries ?? 2;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const promptGraph = interpolateWorkflowTemplate(params.workflowTemplateJson, params.workflowParams);
        const submitRes = await fetch(`${this.baseUrl}/prompt`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptGraph, client_id: crypto.randomUUID() }), signal: AbortSignal.timeout(10000),
        });
        if (!submitRes.ok) throw new Error(`ComfyUI /prompt failed: HTTP ${submitRes.status}`);
        const { prompt_id: promptId } = (await submitRes.json()) as { prompt_id: string };
        if (params.onProgress) await params.onProgress(25);
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1500));
          const histRes = await fetch(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`, { signal: AbortSignal.timeout(5000) });
          if (!histRes.ok) continue;
          const histData = (await histRes.json()) as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>;
          const entry = histData[promptId];
          if (!entry?.outputs) continue;
          for (const nodeOut of Object.values(entry.outputs)) {
            const img = nodeOut.images?.[0];
            if (img) {
              const qs = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
              const viewRes = await fetch(`${this.baseUrl}/view?${qs.toString()}`, { signal: AbortSignal.timeout(10000) });
              if (!viewRes.ok) throw new Error(`ComfyUI /view failed: HTTP ${viewRes.status}`);
              return { buffer: Buffer.from(await viewRes.arrayBuffer()), mimeType: 'image/png', promptId };
            }
          }
        }
        throw new Error('ComfyUI generation timed out after 90s');
      } catch (err) {
        lastError = err;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('ComfyUI generation failed');
  }
}
