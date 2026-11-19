import { env } from '../../config/appConfig';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { OpenAiCloudAdapter } from '../ai/cloud.adapter';
import { ComfyUiService } from '../ai/comfyui.service';

export interface ImageEditorProviderCapability {
  provider: string;
  supportsInpaint: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  supportsDenoise: boolean;
  supportsUpscale: boolean;
  isLocal: boolean;
}

const PROVIDER_CAPABILITIES: ImageEditorProviderCapability[] = [
  { provider: 'heuristic', supportsInpaint: true, supportsNegativePrompt: false, supportsSeed: true, supportsDenoise: true, supportsUpscale: true, isLocal: true },
  { provider: 'comfyui', supportsInpaint: true, supportsNegativePrompt: true, supportsSeed: true, supportsDenoise: true, supportsUpscale: true, isLocal: true },
  { provider: 'cloud-openai', supportsInpaint: true, supportsNegativePrompt: false, supportsSeed: false, supportsDenoise: false, supportsUpscale: false, isLocal: false },
];

const MAX_LOCAL_PIXELS = Number(process.env.MAX_LOCAL_IMAGE_PIXELS || 16_777_216); // 4096x4096 cap

export class ImageEditorProviderAdapter {
  private readonly openAi = new OpenAiCloudAdapter();

  listCapabilities() {
    return PROVIDER_CAPABILITIES;
  }

  async checkGpuAndResourceLimits(provider: string, targetWidth: number, targetHeight: number) {
    const pixels = targetWidth * targetHeight;
    if (pixels > MAX_LOCAL_PIXELS) {
      throw new AppError(400, 'RESOURCE_LIMIT_EXCEEDED', `Target resolution ${targetWidth}x${targetHeight} (${pixels} px) exceeds safe limit (${MAX_LOCAL_PIXELS} px).`);
    }
    if (provider === 'comfyui') {
      try {
        const res = await fetch(`${env.ai.comfyUiBaseUrl}/system_stats`, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const stats = (await res.json()) as { devices?: Array<{ vram_free?: number }> };
          const vramFree = stats.devices?.[0]?.vram_free;
          if (typeof vramFree === 'number' && vramFree < 512 * 1024 * 1024 && pixels > 2048 * 2048) {
            throw new AppError(503, 'INSUFFICIENT_GPU_VRAM', 'Local GPU VRAM is below 512MB for high-resolution ComfyUI job.');
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }
    }
  }

  async checkCloudConsent(workspaceId: string, provider: string, allowCloudUpload?: boolean) {
    if (!provider.startsWith('cloud-')) return;
    const settings = await prisma.workspaceSetting.findUnique({ where: { workspaceId } });
    if (settings?.aiMode === 'LOCAL_ONLY') {
      throw new AppError(403, 'CLOUD_BLOCKED_BY_WORKSPACE_POLICY', 'Workspace AI mode is LOCAL_ONLY. Cloud image editing is disabled.');
    }
    if (!allowCloudUpload) {
      throw new AppError(403, 'CLOUD_UPLOAD_CONSENT_REQUIRED', 'Explicit cloud upload consent (allowCloudUpload=true) is required to send images to cloud providers.');
    }
  }

  async executeGenerativeEdit(params: {
    workspaceId: string;
    provider: string;
    model?: string;
    prompt: string;
    negativePrompt?: string;
    seed?: number;
    denoise?: number;
    baseBuffer: Buffer;
    mimeType: string;
    allowCloudUpload?: boolean;
    fallbackEdit: () => Promise<Buffer>;
  }): Promise<{ buffer: Buffer; providerUsed: string; modelUsed: string; workflowVersion: string; fallbackUsed: boolean }> {
    await this.checkCloudConsent(params.workspaceId, params.provider, params.allowCloudUpload);

    if (params.provider === 'comfyui') {
      try {
        const wf = await prisma.comfyWorkflowTemplate.findFirst({ where: { category: 'IMAGE_EDIT' } });
        if (wf) {
          const comfy = new ComfyUiService();
          const out = await comfy.submitAndWaitForImage({
            workflowTemplateJson: wf.workflowJson,
            workflowParams: {
              prompt: params.prompt,
              negativePrompt: params.negativePrompt,
              model: params.model,
              seed: params.seed,
              denoise: params.denoise ?? 0.65,
            },
            maxRetries: 1,
          });
          return { buffer: out.buffer, providerUsed: 'comfyui', modelUsed: params.model || env.ai.comfyUiDefaultModel, workflowVersion: wf.version, fallbackUsed: false };
        }
      } catch {
        // Fall through to deterministic fallback
      }
    } else if (params.provider === 'cloud-openai' && this.openAi.isConfigured()) {
      try {
        const out = await this.openAi.editImage({ prompt: params.prompt, imageBuffer: params.baseBuffer, mimeType: params.mimeType, model: params.model });
        return { buffer: out.buffer, providerUsed: 'cloud-openai', modelUsed: out.model, workflowVersion: 'cloud-edit-v1', fallbackUsed: false };
      } catch {
        // Fall through to deterministic fallback
      }
    }

    const fbBuf = await params.fallbackEdit();
    return { buffer: fbBuf, providerUsed: 'heuristic', modelUsed: 'sharp-deterministic-editor-v1', workflowVersion: 'local-edit-v1', fallbackUsed: params.provider !== 'heuristic' };
  }
}
