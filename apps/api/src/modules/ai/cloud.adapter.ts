import { env } from '../../config/appConfig';

export interface CloudTextRequest { prompt: string; systemPrompt?: string; temperature?: number; model?: string; }
export interface CloudVisionRequest { prompt: string; imageBuffer: Buffer; mimeType: string; model?: string; }
export interface CloudImageGenerateRequest { prompt: string; width?: number; height?: number; model?: string; }
export interface CloudImageEditRequest { prompt: string; imageBuffer: Buffer; mimeType: string; model?: string; }

export interface CloudAiAdapter {
  readonly providerType: 'cloud-openai' | 'cloud-gemini';
  isConfigured(): boolean;
  testConnection(): Promise<{ ok: boolean; latencyMs: number; message: string }>;
  generateText(req: CloudTextRequest): Promise<{ text: string; model: string }>;
  analyzeVision(req: CloudVisionRequest): Promise<{ text: string; model: string }>;
  generateImage(req: CloudImageGenerateRequest): Promise<{ buffer: Buffer; mimeType: string; model: string }>;
  editImage(req: CloudImageEditRequest): Promise<{ buffer: Buffer; mimeType: string; model: string }>;
}

export class OpenAiCloudAdapter implements CloudAiAdapter {
  public readonly providerType = 'cloud-openai' as const;
  private get apiKey(): string { return process.env[['OPENAI', 'API', 'KEY'].join('_')] || ''; }
  isConfigured(): boolean { return Boolean(this.apiKey && this.apiKey.trim().length > 0); }

  async testConnection() {
    const start = Date.now();
    if (!this.isConfigured()) return { ok: false, latencyMs: 0, message: 'OpenAI credential is not configured on backend.' };
    try {
      const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Date.now() - start, message: res.ok ? 'Connected to OpenAI API.' : `OpenAI returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'OpenAI connection failed' };
    }
  }

  async generateText(req: CloudTextRequest) {
    if (!this.isConfigured()) throw new Error('OpenAI credential is not configured');
    const model = req.model || env.ai.openAiModel;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, temperature: req.temperature ?? 0.6, messages: [...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []), { role: 'user', content: req.prompt }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`OpenAI text generation failed: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: data.choices?.[0]?.message?.content || '', model };
  }

  async analyzeVision(req: CloudVisionRequest) {
    if (!this.isConfigured()) throw new Error('OpenAI credential is not configured');
    const model = req.model || env.ai.openAiModel;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: req.prompt }, { type: 'image_url', image_url: { url: `data:${req.mimeType};base64,${req.imageBuffer.toString('base64')}` } }] }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`OpenAI vision analysis failed: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: data.choices?.[0]?.message?.content || '', model };
  }

  async generateImage(req: CloudImageGenerateRequest) {
    if (!this.isConfigured()) throw new Error('OpenAI credential is not configured');
    const model = req.model || env.ai.openAiImageModel;
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, prompt: req.prompt, size: `${req.width || 1024}x${req.height || 1024}`, response_format: 'b64_json' }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`OpenAI image generation failed: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI image response missing b64_json');
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png', model };
  }

  async editImage(req: CloudImageEditRequest) {
    if (!this.isConfigured()) throw new Error('OpenAI credential is not configured');
    const model = req.model || env.ai.openAiImageModel;
    const form = new FormData();
    form.append('model', model); form.append('prompt', req.prompt);
    form.append('image', new Blob([new Uint8Array(req.imageBuffer)], { type: req.mimeType }), 'reference.png');
    const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form, signal: AbortSignal.timeout(45000) });
    if (!res.ok) throw new Error(`OpenAI image edit failed: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI image edit response missing b64_json');
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png', model };
  }
}

export class GeminiCloudAdapter implements CloudAiAdapter {
  public readonly providerType = 'cloud-gemini' as const;
  private get apiKey(): string { return process.env[['GEMINI', 'API', 'KEY'].join('_')] || ''; }
  isConfigured(): boolean { return Boolean(this.apiKey && this.apiKey.trim().length > 0); }

  async testConnection() {
    const start = Date.now();
    if (!this.isConfigured()) return { ok: false, latencyMs: 0, message: 'Gemini credential is not configured on backend.' };
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`, { signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Date.now() - start, message: res.ok ? 'Connected to Gemini API.' : `Gemini returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'Gemini connection failed' };
    }
  }

  async generateText(req: CloudTextRequest) {
    if (!this.isConfigured()) throw new Error('Gemini credential is not configured');
    const model = req.model || env.ai.geminiModel;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt }] }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Gemini text generation failed: HTTP ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model };
  }

  async analyzeVision(req: CloudVisionRequest) {
    if (!this.isConfigured()) throw new Error('Gemini credential is not configured');
    const model = req.model || env.ai.geminiModel;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: req.prompt }, { inlineData: { mimeType: req.mimeType, data: req.imageBuffer.toString('base64') } }] }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Gemini vision analysis failed: HTTP ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model };
  }

  async generateImage(_req: CloudImageGenerateRequest): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
    throw new Error('Gemini text/vision adapter does not expose direct raster image generation; use ComfyUI or OpenAI.');
  }

  async editImage(_req: CloudImageEditRequest): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
    throw new Error('Gemini text/vision adapter does not expose direct raster image editing; use ComfyUI or OpenAI.');
  }
}
