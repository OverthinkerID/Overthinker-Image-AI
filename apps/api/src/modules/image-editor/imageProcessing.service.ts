import sharp from 'sharp';

export interface ImageAdjustments {
  brightness?: number; // 0.5 - 2.0 (1.0 default)
  contrast?: number;   // 0.5 - 2.0 (1.0 default)
  saturation?: number; // 0.0 - 2.0 (1.0 default)
  exposure?: number;   // -1.0 to +1.0 (0 default)
  sharpness?: number;  // 0 - 5 (0 default)
  denoise?: number;    // 0 - 5 (0 default)
}

export interface MaskGeometry {
  strokes?: Array<{ points: Array<{ x: number; y: number }>; brushSize: number }>;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  polygons?: Array<Array<{ x: number; y: number }>>;
}

export interface ProtectedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ImageProcessingService {
  async getMetadata(buffer: Buffer) {
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width || 512,
      height: meta.height || 512,
      format: (meta.format || 'png').toUpperCase(),
      hasAlpha: Boolean(meta.hasAlpha),
    };
  }

  async crop(buffer: Buffer, rect: { left: number; top: number; width: number; height: number }) {
    const meta = await this.getMetadata(buffer);
    const left = Math.max(0, Math.min(meta.width - 1, Math.round(rect.left)));
    const top = Math.max(0, Math.min(meta.height - 1, Math.round(rect.top)));
    const width = Math.max(1, Math.min(meta.width - left, Math.round(rect.width)));
    const height = Math.max(1, Math.min(meta.height - top, Math.round(rect.height)));
    return sharp(buffer).extract({ left, top, width, height }).png().toBuffer();
  }

  async resize(buffer: Buffer, width: number, height: number, fit: 'contain' | 'cover' | 'fill' = 'contain') {
    return sharp(buffer).resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), { fit }).png().toBuffer();
  }

  async rotate(buffer: Buffer, angle: number) {
    return sharp(buffer).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }

  async flip(buffer: Buffer, opts: { horizontal?: boolean; vertical?: boolean }) {
    let pipe = sharp(buffer);
    if (opts.vertical) pipe = pipe.flip();
    if (opts.horizontal) pipe = pipe.flop();
    return pipe.png().toBuffer();
  }

  async adjust(buffer: Buffer, adj: ImageAdjustments) {
    const exposureMult = adj.exposure ? Math.pow(2, adj.exposure) : 1;
    const brightness = (adj.brightness ?? 1) * exposureMult;
    const saturation = adj.saturation ?? 1;
    let pipe = sharp(buffer).modulate({ brightness, saturation });
    if (adj.contrast && adj.contrast !== 1) {
      const a = adj.contrast;
      const b = 128 * (1 - a);
      pipe = pipe.linear(a, b);
    }
    if (adj.denoise && adj.denoise > 0) {
      pipe = pipe.median(Math.min(5, Math.max(3, Math.round(adj.denoise) | 1)));
    }
    if (adj.sharpness && adj.sharpness > 0) {
      pipe = pipe.sharpen({ sigma: Math.min(4, 0.5 + adj.sharpness * 0.6) });
    }
    return pipe.png().toBuffer();
  }

  async upscale(buffer: Buffer, factor: 2 | 4) {
    const meta = await this.getMetadata(buffer);
    const targetW = meta.width * factor;
    const targetH = meta.height * factor;
    return sharp(buffer)
      .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: factor === 4 ? 1.2 : 0.8 })
      .png()
      .toBuffer();
  }

  async removeBackground(buffer: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Sample corner pixel as background reference
    const bgR = data[0], bgG = data[1], bgB = data[2];
    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += 4) {
      const dist = Math.sqrt((out[i] - bgR) ** 2 + (out[i + 1] - bgG) ** 2 + (out[i + 2] - bgB) ** 2);
      if (dist < 36) out[i + 3] = 0;
      else if (dist < 56) out[i + 3] = Math.round(((dist - 36) / 20) * out[i + 3]);
    }
    return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  }

  async replaceBackground(
    foregroundBuffer: Buffer,
    opts: { preset: string; color?: string; gradientEnd?: string; customBgBuffer?: Buffer }
  ): Promise<Buffer> {
    const fgNoBg = await this.removeBackground(foregroundBuffer);
    const meta = await this.getMetadata(fgNoBg);

    if (opts.preset === 'TRANSPARENT') return fgNoBg;

    let bgBuf: Buffer;
    if (opts.customBgBuffer) {
      bgBuf = await sharp(opts.customBgBuffer).resize(meta.width, meta.height, { fit: 'cover' }).png().toBuffer();
    } else {
      const presetColors: Record<string, [string, string]> = {
        SOLID: [opts.color || '#0F172A', opts.color || '#0F172A'],
        GRADIENT: [opts.color || '#1E293B', opts.gradientEnd || '#2563EB'],
        STUDIO: ['#1E293B', '#090D16'],
        LIFESTYLE: ['#F5F0E8', '#E2D5C3'],
        CORPORATE: ['#F8FAFC', '#CBD5E1'],
        LUXURY: ['#18181B', '#451A03'],
        NATURE: ['#064E3B', '#0F172A'],
      };
      const [c1, c2] = presetColors[opts.preset] || presetColors.STUDIO;
      const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
        <rect width="${meta.width}" height="${meta.height}" fill="url(#g)"/>
      </svg>`;
      bgBuf = await sharp(Buffer.from(bgSvg, 'utf8')).png().toBuffer();
    }

    return sharp(bgBuf).composite([{ input: fgNoBg, left: 0, top: 0 }]).png().toBuffer();
  }

  async renderMaskPng(
    width: number,
    height: number,
    geometry: MaskGeometry,
    opts?: { featherPx?: number; inverted?: boolean }
  ): Promise<Buffer> {
    const fg = opts?.inverted ? '#000000' : '#FFFFFF';
    const bg = opts?.inverted ? '#FFFFFF' : '#000000';
    const shapes: string[] = [`<rect width="${width}" height="${height}" fill="${bg}"/>`];

    for (const r of geometry.rects || []) {
      shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${fg}"/>`);
    }
    for (const poly of geometry.polygons || []) {
      const pts = poly.map((p) => `${p.x},${p.y}`).join(' ');
      if (pts) shapes.push(`<polygon points="${pts}" fill="${fg}"/>`);
    }
    for (const st of geometry.strokes || []) {
      const d = st.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      if (d) shapes.push(`<path d="${d}" fill="none" stroke="${fg}" stroke-width="${st.brushSize}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes.join('')}</svg>`;
    let pipe = sharp(Buffer.from(svg, 'utf8'));
    if (opts?.featherPx && opts.featherPx > 0) {
      pipe = pipe.blur(Math.min(25, Math.max(0.5, opts.featherPx)));
    }
    return pipe.png().toBuffer();
  }

  async applyProtectedRegions(
    originalBuffer: Buffer,
    editedBuffer: Buffer,
    protectedBoxes: ProtectedBox[]
  ): Promise<Buffer> {
    if (protectedBoxes.length === 0) return editedBuffer;
    const meta = await this.getMetadata(editedBuffer);
    const origResized = await sharp(originalBuffer).resize(meta.width, meta.height, { fit: 'fill' }).png().toBuffer();

    const overlays: sharp.OverlayOptions[] = [];
    for (const box of protectedBoxes) {
      const left = Math.max(0, Math.min(meta.width - 1, Math.round(box.x)));
      const top = Math.max(0, Math.min(meta.height - 1, Math.round(box.y)));
      const width = Math.max(1, Math.min(meta.width - left, Math.round(box.width)));
      const height = Math.max(1, Math.min(meta.height - top, Math.round(box.height)));
      const patch = await sharp(origResized).extract({ left, top, width, height }).png().toBuffer();
      overlays.push({ input: patch, left, top });
    }
    return sharp(editedBuffer).composite(overlays).png().toBuffer();
  }

  async compositeProtectedLogo(
    baseBuffer: Buffer,
    logoBuffer: Buffer,
    placement: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    const baseMeta = await this.getMetadata(baseBuffer);
    const w = Math.max(16, Math.min(baseMeta.width, Math.round(placement.width)));
    const h = Math.max(16, Math.min(baseMeta.height, Math.round(placement.height)));
    const logoResized = await sharp(logoBuffer).resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const left = Math.max(0, Math.min(baseMeta.width - w, Math.round(placement.x)));
    const top = Math.max(0, Math.min(baseMeta.height - h, Math.round(placement.y)));
    return sharp(baseBuffer).composite([{ input: logoResized, left, top }]).png().toBuffer();
  }

  async exportImage(buffer: Buffer, format: 'PNG' | 'JPG' | 'WEBP'): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
    if (format === 'JPG') return { buffer: await sharp(buffer).jpeg({ quality: 92 }).toBuffer(), mimeType: 'image/jpeg', ext: 'jpg' };
    if (format === 'WEBP') return { buffer: await sharp(buffer).webp({ quality: 92 }).toBuffer(), mimeType: 'image/webp', ext: 'webp' };
    return { buffer: await sharp(buffer).png().toBuffer(), mimeType: 'image/png', ext: 'png' };
  }
}
