import path from 'node:path';

const cwd = process.cwd();
const projectRoot = cwd.endsWith(path.join('apps', 'api'))
  ? path.resolve(cwd, '..', '..')
  : cwd;
const defaultStorageRoot = path.resolve(projectRoot, 'storage');

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  storageRoot: process.env.STORAGE_ROOT
    ? path.resolve(process.env.STORAGE_ROOT)
    : defaultStorageRoot,
  maxLogoFileSizeBytes: Number(process.env.MAX_LOGO_FILE_SIZE_MB || 15) * 1024 * 1024,
  ai: {
    provider: (process.env.AI_PROVIDER || 'heuristic') as
      | 'heuristic'
      | 'local-ollama'
      | 'local-openai'
      | 'cloud-openai'
      | 'cloud-gemini',
    mode: (process.env.AI_MODE || 'HYBRID') as 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'HYBRID',
    comfyUiBaseUrl: process.env.COMFYUI_BASE_URL || 'http://localhost:8188',
    comfyUiDefaultModel: process.env.COMFYUI_DEFAULT_MODEL || 'sd_xl_base_1.0.safetensors',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    localOpenAiBaseUrl: process.env.LOCAL_OPENAI_BASE_URL || 'http://localhost:1234/v1',
    localOpenAiModel: process.env.LOCAL_OPENAI_MODEL || 'local-model',
    openAiModel: 'gpt-4o-mini',
    openAiImageModel: 'gpt-image-1',
    geminiModel: 'gemini-2.0-flash',
  },
};
