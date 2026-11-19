export interface RgbColor { r: number; g: number; b: number; }

export interface ExtractedColorCandidate {
  hex: string; rgb: string; hsl: string; dominance: number;
  r: number; g: number; b: number; saturation: number; lightness: number;
}

export interface SuggestedBrandColor {
  role: 'PRIMARY' | 'SECONDARY' | 'ACCENT' | 'NEUTRAL_LIGHT' | 'NEUTRAL_DARK' | 'BG_LIGHT' | 'BG_DARK';
  name: string; hex: string; rgb: string; hsl: string; dominance: number;
}

export function clampByte(n: number): number { return Math.max(0, Math.min(255, Math.round(n))); }

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clampByte(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): RgbColor | null {
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return { r: parseInt(clean[0] + clean[0], 16), g: parseInt(clean[1] + clean[1], 16), b: parseInt(clean[2] + clean[2], 16) };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
  }
  return null;
}

export function rgbToHslValues(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function formatColorStrings(r: number, g: number, b: number) {
  const cr = clampByte(r), cg = clampByte(g), cb = clampByte(b);
  const { h, s, l } = rgbToHslValues(cr, cg, cb);
  return { hex: rgbToHex(cr, cg, cb), rgb: `rgb(${cr}, ${cg}, ${cb})`, hsl: `hsl(${h}, ${s}%, ${l}%)`, saturation: s, lightness: l };
}

export function colorDistance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function extractDominantColorsFromRgba(rgba: Uint8Array | Buffer, maxColors = 6) {
  const buckets = new Map<string, { rSum: number; gSum: number; bSum: number; count: number }>();
  let opaquePixels = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 32) continue;
    opaquePixels++;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const key = `${Math.floor(r / 24)}-${Math.floor(g / 24)}-${Math.floor(b / 24)}`;
    const bucket = buckets.get(key);
    if (bucket) { bucket.rSum += r; bucket.gSum += g; bucket.bSum += b; bucket.count++; }
    else buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
  }
  if (opaquePixels === 0) return { candidates: [], isMonochrome: true };
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const merged: ExtractedColorCandidate[] = [];
  for (const item of sorted) {
    const r = Math.round(item.rSum / item.count), g = Math.round(item.gSum / item.count), b = Math.round(item.bSum / item.count);
    if (merged.some((m) => colorDistance(m, { r, g, b }) < 38)) continue;
    const formatted = formatColorStrings(r, g, b);
    merged.push({ r, g, b, ...formatted, dominance: Number((item.count / opaquePixels).toFixed(4)) });
    if (merged.length >= maxColors) break;
  }
  const chromaticCount = merged.filter((c) => c.saturation > 14).length;
  return { candidates: merged, isMonochrome: chromaticCount <= 1 && merged.length <= 2 };
}

export function extractSvgDeclaredColors(svgContent: string): ExtractedColorCandidate[] {
  const counts = new Map<string, number>();
  for (const raw of svgContent.match(/#[0-9a-fA-F]{3,6}\b/g) || []) {
    const rgb = hexToRgb(raw);
    if (!rgb) continue;
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const total = [...counts.values()].reduce((s, v) => s + v, 0) || 1;
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([hex, count]) => {
    const rgb = hexToRgb(hex)!;
    return { ...rgb, ...formatColorStrings(rgb.r, rgb.g, rgb.b), dominance: Number((count / total).toFixed(4)) };
  });
}

export function buildBrandColorPalette(candidates: ExtractedColorCandidate[], backgroundType: string): SuggestedBrandColor[] {
  const chromatic = candidates.filter((c) => c.saturation >= 15);
  const primarySrc = chromatic[0] || candidates[0] || { r: 37, g: 99, b: 235, ...formatColorStrings(37, 99, 235), dominance: 1 };
  const secondarySrc = chromatic[1] || candidates[1] || {
    r: clampByte(primarySrc.r * 0.72 + 20), g: clampByte(primarySrc.g * 0.72 + 20), b: clampByte(primarySrc.b * 0.72 + 35),
    ...formatColorStrings(clampByte(primarySrc.r * 0.72 + 20), clampByte(primarySrc.g * 0.72 + 20), clampByte(primarySrc.b * 0.72 + 35)),
    dominance: 0.25,
  };
  const accentSrc = chromatic[2] || {
    r: clampByte(255 - primarySrc.r * 0.4), g: clampByte(primarySrc.g * 0.6 + 80), b: clampByte(primarySrc.b * 0.5 + 60),
    ...formatColorStrings(clampByte(255 - primarySrc.r * 0.4), clampByte(primarySrc.g * 0.6 + 80), clampByte(primarySrc.b * 0.5 + 60)),
    dominance: 0.15,
  };
  const neutralLight = formatColorStrings(248, 250, 252);
  const neutralDark = formatColorStrings(15, 23, 42);
  const bgLight = backgroundType === 'DARK' ? formatColorStrings(241, 245, 249) : formatColorStrings(255, 255, 255);
  const bgDark = backgroundType === 'LIGHT' ? formatColorStrings(11, 17, 32) : formatColorStrings(17, 24, 39);

  return [
    { role: 'PRIMARY', name: 'Primary Brand', hex: primarySrc.hex, rgb: primarySrc.rgb, hsl: primarySrc.hsl, dominance: primarySrc.dominance },
    { role: 'SECONDARY', name: 'Secondary Brand', hex: secondarySrc.hex, rgb: secondarySrc.rgb, hsl: secondarySrc.hsl, dominance: secondarySrc.dominance },
    { role: 'ACCENT', name: 'Accent Highlight', hex: accentSrc.hex, rgb: accentSrc.rgb, hsl: accentSrc.hsl, dominance: accentSrc.dominance },
    { role: 'NEUTRAL_LIGHT', name: 'Neutral Surface Light', hex: neutralLight.hex, rgb: neutralLight.rgb, hsl: neutralLight.hsl, dominance: 0 },
    { role: 'NEUTRAL_DARK', name: 'Neutral Ink Dark', hex: neutralDark.hex, rgb: neutralDark.rgb, hsl: neutralDark.hsl, dominance: 0 },
    { role: 'BG_LIGHT', name: 'Recommended Light Background', hex: bgLight.hex, rgb: bgLight.rgb, hsl: bgLight.hsl, dominance: 0 },
    { role: 'BG_DARK', name: 'Recommended Dark Background', hex: bgDark.hex, rgb: bgDark.rgb, hsl: bgDark.hsl, dominance: 0 },
  ];
}
