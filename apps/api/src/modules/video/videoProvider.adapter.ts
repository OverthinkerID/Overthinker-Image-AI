import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface VideoProviderCapability {
  provider: string;
  mode: 'LOCAL' | 'CLOUD';
  status: 'AVAILABLE' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsReferenceToVideo: boolean;
  supportsLogoCompositing: boolean;
  maxDurationSec: number;
  notes: string;
}

export async function checkFfmpegAvailability(): Promise<{ available: boolean; version: string | null }> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 3000 });
    const firstLine = stdout.split('\n')[0]?.trim() || 'ffmpeg available';
    return { available: true, version: firstLine };
  } catch {
    return { available: false, version: null };
  }
}

export async function discoverVideoProviders(): Promise<VideoProviderCapability[]> {
  const ffmpeg = await checkFfmpegAvailability();
  const comfyUrl = process.env.COMFYUI_BASE_URL || '';
  const runwayKey = process.env[['RUNWAY', 'API', 'KEY'].join('_')] || '';
  const lumaKey = process.env[['LUMA', 'API', 'KEY'].join('_')] || '';

  return [
    {
      provider: 'local-ffmpeg',
      mode: 'LOCAL',
      status: ffmpeg.available ? 'AVAILABLE' : 'UNAVAILABLE',
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsReferenceToVideo: true,
      supportsLogoCompositing: true,
      maxDurationSec: 120,
      notes: ffmpeg.available
        ? `Deterministic FFmpeg compositor (${ffmpeg.version})`
        : 'FFmpeg binary not detected in PATH; falls back to storyboard/motion-bundle manifest.'
    },
    {
      provider: 'comfyui-video',
      mode: 'LOCAL',
      status: comfyUrl ? 'AVAILABLE' : 'NOT_CONFIGURED',
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsReferenceToVideo: true,
      supportsLogoCompositing: false,
      maxDurationSec: 10,
      notes: 'Local ComfyUI AnimateDiff / SVD / CogVideoX adapter (respects GPU/VRAM limits).'
    },
    {
      provider: 'cloud-runway',
      mode: 'CLOUD',
      status: runwayKey ? 'AVAILABLE' : 'NOT_CONFIGURED',
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsReferenceToVideo: false,
      supportsLogoCompositing: false,
      maxDurationSec: 10,
      notes: 'Cloud video generation adapter; requires explicit cloud consent and API key.'
    },
    {
      provider: 'cloud-luma',
      mode: 'CLOUD',
      status: lumaKey ? 'AVAILABLE' : 'NOT_CONFIGURED',
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsReferenceToVideo: true,
      supportsLogoCompositing: false,
      maxDurationSec: 10,
      notes: 'Cloud Dream Machine adapter; requires explicit cloud consent and API key.'
    }
  ];
}
