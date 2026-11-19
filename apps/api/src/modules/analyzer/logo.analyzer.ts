import sharp from 'sharp';
import {
  extractDominantColorsFromRgba,
  extractSvgDeclaredColors,
  rgbToHex,
  type ExtractedColorCandidate,
} from './color.extractor';

export interface LogoAnalysisResult {
  format: string; width: number; height: number; aspectRatio: string; aspectLabel: 'square' | 'landscape' | 'portrait';
  hasTransparency: boolean; transparencyRatio: number; backgroundType: 'TRANSPARENT' | 'LIGHT' | 'DARK' | 'COLORED' | 'UNKNOWN';
  backgroundHex: string | null; isMonochrome: boolean; colorCount: number; shapeStyle: string;
  visualElements: string[]; extractedColors: ExtractedColorCandidate[]; svgTextSegments: string[]; svgFontFamilies: string[];
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

export function computeAspectRatio(width: number, height: number) {
  if (!width || !height) return { aspectRatio: '1:1', aspectLabel: 'square' as const };
  const divisor = gcd(width, height);
  const ratio = width / height;
  const aspectLabel = Math.abs(ratio - 1) < 0.08 ? 'square' : ratio > 1 ? 'landscape' : 'portrait';
  return { aspectRatio: `${Math.round(width / divisor)}:${Math.round(height / divisor)}`, aspectLabel: aspectLabel as 'square' | 'landscape' | 'portrait' };
}

function detectEdgeBackground(rgba: Uint8Array | Buffer, width: number, height: number) {
  let transparentCount = 0;
  const totalPixels = Math.max(1, width * height);
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 245) transparentCount++;
  const transparencyRatio = Number((transparentCount / totalPixels).toFixed(4));
  const hasTransparency = transparencyRatio > 0.02;

  let edgeTransparent = 0, edgeCount = 0, rSum = 0, gSum = 0, bSum = 0;
  const coords: Array<[number, number]> = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) coords.push([x, 0], [x, height - 1]);
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 20))) coords.push([0, y], [width - 1, y]);

  for (const [x, y] of coords) {
    const idx = (y * width + x) * 4;
    if (idx + 3 >= rgba.length) continue;
    edgeCount++;
    if (rgba[idx + 3] < 40) edgeTransparent++;
    else { rSum += rgba[idx]; gSum += rgba[idx + 1]; bSum += rgba[idx + 2]; }
  }
  if (edgeCount > 0 && edgeTransparent / edgeCount > 0.6) {
    return { hasTransparency: true, transparencyRatio, backgroundType: 'TRANSPARENT' as const, backgroundHex: null };
  }
  const opaqueEdge = Math.max(1, edgeCount - edgeTransparent);
  const avgR = rSum / opaqueEdge, avgG = gSum / opaqueEdge, avgB = bSum / opaqueEdge;
  const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
  const maxC = Math.max(avgR, avgG, avgB), minC = Math.min(avgR, avgG, avgB);
  const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
  let backgroundType: 'LIGHT' | 'DARK' | 'COLORED' = 'COLORED';
  if (saturation < 0.18 && luminance >= 0.72) backgroundType = 'LIGHT';
  else if (saturation < 0.22 && luminance <= 0.28) backgroundType = 'DARK';
  return { hasTransparency, transparencyRatio, backgroundType, backgroundHex: rgbToHex(avgR, avgG, avgB) };
}

export function analyzeSvgMarkup(svgText: string) {
  const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const widthMatch = svgText.match(/\bwidth\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  const heightMatch = svgText.match(/\bheight\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  const width = Math.round(Number(widthMatch?.[1] || viewBoxMatch?.[1] || 512));
  const height = Math.round(Number(heightMatch?.[1] || viewBoxMatch?.[2] || 512));

  const counts = {
    path: (svgText.match(/<path\b/gi) || []).length,
    circle: (svgText.match(/<circle\b|<ellipse\b/gi) || []).length,
    rect: (svgText.match(/<rect\b/gi) || []).length,
    polygon: (svgText.match(/<polygon\b|<polyline\b/gi) || []).length,
    text: (svgText.match(/<text\b/gi) || []).length,
  };
  const visualElements: string[] = [];
  if (counts.circle > 0) visualElements.push(`circular-forms (${counts.circle})`);
  if (counts.rect > 0) visualElements.push(`rectangular-geometry (${counts.rect})`);
  if (counts.polygon > 0) visualElements.push(`polygonal-facets (${counts.polygon})`);
  if (counts.path > 0) visualElements.push(`vector-paths (${counts.path})`);
  if (counts.text > 0) visualElements.push(`embedded-typography (${counts.text})`);
  if (visualElements.length === 0) visualElements.push('minimal-vector-mark');

  let shapeStyle = 'geometric-mark';
  if (counts.text > 0 && counts.path + counts.circle + counts.rect <= 2) shapeStyle = 'wordmark';
  else if (counts.text > 0) shapeStyle = 'combination-mark';
  else if (counts.circle >= 2 && counts.rect === 0) shapeStyle = 'organic-curved';
  else if (counts.path > 6) shapeStyle = 'emblem-detailed';

  const svgTextSegments: string[] = [];
  const textTagRegex = /<(?:text|tspan)[^>]*>([^<]+)<\/(?:text|tspan)>/gi;
  let match: RegExpExecArray | null;
  while ((match = textTagRegex.exec(svgText)) !== null) {
    const cleaned = match[1].trim();
    if (cleaned) svgTextSegments.push(cleaned);
  }
  const svgFontFamilies: string[] = [];
  const fontRegex = /font-family\s*[:=]\s*["']?([^;"'>]+)["']?/gi;
  while ((match = fontRegex.exec(svgText)) !== null) {
    const fam = match[1].trim();
    if (fam && !svgFontFamilies.includes(fam)) svgFontFamilies.push(fam);
  }
  return { width, height, visualElements, shapeStyle, svgTextSegments, svgFontFamilies };
}

export async function analyzeLogoBuffer(buffer: Buffer, mimeType: string): Promise<LogoAnalysisResult> {
  const isSvg = mimeType === 'image/svg+xml';
  let svgMeta: ReturnType<typeof analyzeSvgMarkup> | null = null;
  let declaredSvgColors: ExtractedColorCandidate[] = [];
  if (isSvg) {
    const svgText = buffer.toString('utf8');
    svgMeta = analyzeSvgMarkup(svgText);
    declaredSvgColors = extractSvgDeclaredColors(svgText);
  }
  const image = sharp(buffer, { density: 150 });
  const metadata = await image.metadata();
  const width = svgMeta?.width || metadata.width || 512;
  const height = svgMeta?.height || metadata.height || 512;
  const format = (metadata.format || (isSvg ? 'svg' : 'unknown')).toUpperCase();
  const { data: rgba, info } = await image.resize(160, 160, { fit: 'inside', withoutEnlargement: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bgInfo = detectEdgeBackground(rgba, info.width, info.height);
  const { candidates: rasterColors, isMonochrome } = extractDominantColorsFromRgba(rgba, 6);
  const extractedColors = declaredSvgColors.length > 0 && rasterColors.length === 0 ? declaredSvgColors : rasterColors;
  const { aspectRatio, aspectLabel } = computeAspectRatio(width, height);
  const visualElements = svgMeta?.visualElements || [
    aspectLabel === 'square' ? 'balanced-icon-silhouette' : 'horizontal-or-vertical-lockup',
    bgInfo.hasTransparency ? 'alpha-cutout-foreground' : 'solid-canvas-composition',
    isMonochrome ? 'monochrome-high-contrast' : 'multi-tone-color-regions',
  ];
  const shapeStyle = svgMeta?.shapeStyle || (aspectLabel === 'landscape' ? 'wordmark-or-lockup' : isMonochrome ? 'minimal-geometric' : 'modern-brand-mark');

  return {
    format, width, height, aspectRatio, aspectLabel,
    hasTransparency: bgInfo.hasTransparency, transparencyRatio: bgInfo.transparencyRatio,
    backgroundType: bgInfo.backgroundType, backgroundHex: bgInfo.backgroundHex,
    isMonochrome, colorCount: extractedColors.length, shapeStyle, visualElements, extractedColors,
    svgTextSegments: svgMeta?.svgTextSegments || [], svgFontFamilies: svgMeta?.svgFontFamilies || [],
  };
}
