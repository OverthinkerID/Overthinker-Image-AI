import type { LogoAnalysisResult } from './logo.analyzer';

export interface TypographyAnalysisResult {
  extractedText: string | null; hasText: boolean; ocrConfidence: number;
  detectedStyle: 'sans-serif' | 'serif' | 'monospace' | 'display' | 'unknown';
  identificationConfidence: number; confidenceNote: string;
  headingFont: string; bodyFont: string; headingFallback: string; bodyFallback: string;
  recommendations: Array<{ headingFont: string; bodyFont: string; rationale: string }>;
}

function classifyFontFamily(families: string[]): TypographyAnalysisResult['detectedStyle'] {
  const joined = families.join(' ').toLowerCase();
  if (!joined) return 'unknown';
  if (/mono|courier|consolas|jetbrains|fira code/.test(joined)) return 'monospace';
  if (/serif|times|georgia|garamond|playfair|merriweather/.test(joined) && !/sans/.test(joined)) return 'serif';
  if (/display|impact|bebas|oswald|lobster|pacifico/.test(joined)) return 'display';
  if (/sans|inter|roboto|helvetica|arial|poppins|montserrat|open sans/.test(joined)) return 'sans-serif';
  return 'unknown';
}

function getCuratedPairings(style: TypographyAnalysisResult['detectedStyle'], shapeStyle: string) {
  if (style === 'serif' || shapeStyle.includes('emblem')) {
    return [
      { headingFont: 'Playfair Display', bodyFont: 'Inter', rationale: 'Editorial serif authority paired with crisp geometric UI legibility.' },
      { headingFont: 'Cormorant Garamond', bodyFont: 'Plus Jakarta Sans', rationale: 'Refined heritage contrast for premium brand storytelling.' },
    ];
  }
  if (style === 'monospace') {
    return [
      { headingFont: 'Space Grotesk', bodyFont: 'JetBrains Mono', rationale: 'Technical precision with modern developer-first readability.' },
      { headingFont: 'IBM Plex Sans', bodyFont: 'IBM Plex Mono', rationale: 'Cohesive industrial-grade type system.' },
    ];
  }
  return [
    { headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter', rationale: 'Clean contemporary geometric sans pairing suited for digital-first brands.' },
    { headingFont: 'Space Grotesk', bodyFont: 'DM Sans', rationale: 'Distinctive character in headlines with neutral body clarity.' },
  ];
}

export async function analyzeTypography(buffer: Buffer, mimeType: string, logoAnalysis: LogoAnalysisResult): Promise<TypographyAnalysisResult> {
  if (mimeType === 'image/svg+xml' && logoAnalysis.svgTextSegments.length > 0) {
    const extractedText = logoAnalysis.svgTextSegments.join(' ').trim();
    const detectedStyle = classifyFontFamily(logoAnalysis.svgFontFamilies);
    const hasExplicitFont = logoAnalysis.svgFontFamilies.length > 0;
    const recommendations = getCuratedPairings(detectedStyle, logoAnalysis.shapeStyle);
    return {
      extractedText, hasText: true, ocrConfidence: 0.95, detectedStyle,
      identificationConfidence: hasExplicitFont ? 0.9 : 0.45,
      confidenceNote: hasExplicitFont
        ? `Detected embedded SVG font-family metadata (${logoAnalysis.svgFontFamilies.join(', ')}).`
        : 'Text found in SVG without explicit font-family metadata; exact typeface identification is not claimed.',
      headingFont: logoAnalysis.svgFontFamilies[0] || recommendations[0].headingFont,
      bodyFont: recommendations[0].bodyFont,
      headingFallback: detectedStyle === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif',
      bodyFallback: 'system-ui, -apple-system, sans-serif',
      recommendations,
    };
  }

  let extractedText: string | null = null;
  let ocrConfidence = 0;
  if (mimeType !== 'image/svg+xml') {
    try {
      const tesseract = await import('tesseract.js');
      const result = await tesseract.recognize(buffer, 'eng');
      const text = result?.data?.text?.replace(/\s+/g, ' ').trim() || '';
      const conf = Number(result?.data?.confidence || 0) / 100;
      if (text.length >= 2 && conf >= 0.45) { extractedText = text; ocrConfidence = Number(conf.toFixed(2)); }
    } catch { /* OCR unavailable */ }
  }

  const hasText = Boolean(extractedText);
  const detectedStyle: TypographyAnalysisResult['detectedStyle'] = hasText ? 'sans-serif' : 'unknown';
  const recommendations = getCuratedPairings(detectedStyle, logoAnalysis.shapeStyle);
  return {
    extractedText, hasText, ocrConfidence, detectedStyle,
    identificationConfidence: hasText ? 0.35 : 0,
    confidenceNote: hasText
      ? 'OCR extracted text from raster image, but raster pixels are insufficient for exact font identification. Style classification and curated pairings are recommended instead.'
      : 'No readable text detected in the logo (or logo is purely iconic). Exact font identification is not claimed; recommended brand typography pairings are provided.',
    headingFont: recommendations[0].headingFont,
    bodyFont: recommendations[0].bodyFont,
    headingFallback: 'system-ui, -apple-system, sans-serif',
    bodyFallback: 'system-ui, -apple-system, sans-serif',
    recommendations,
  };
}
