import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { analyzeLogoBuffer } from '../dist/modules/analyzer/logo.analyzer.js';
import { buildBrandColorPalette } from '../dist/modules/analyzer/color.extractor.js';
import { analyzeTypography } from '../dist/modules/analyzer/typography.analyzer.js';
import { HeuristicPersonalityAdapter } from '../dist/modules/ai/provider.adapter.js';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createSolidRgbaPng(width, height, r, g, b, a) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('Phase 2: Logo Analyzer extracts dimensions, aspect ratio, colors, and transparency from PNG', async () => {
  const pngBuf = createSolidRgbaPng(200, 100, 37, 99, 235, 255);
  const analysis = await analyzeLogoBuffer(pngBuf, 'image/png');

  assert.equal(analysis.width, 200);
  assert.equal(analysis.height, 100);
  assert.equal(analysis.aspectRatio, '2:1');
  assert.equal(analysis.aspectLabel, 'landscape');
  assert.equal(analysis.hasTransparency, false);
  assert.ok(analysis.extractedColors.length >= 1);

  const palette = buildBrandColorPalette(analysis.extractedColors, analysis.backgroundType);
  assert.equal(palette.length, 7);
  assert.ok(palette.some((c) => c.role === 'PRIMARY' && c.hex.startsWith('#')));
  assert.ok(palette.some((c) => c.role === 'BG_LIGHT'));
  assert.ok(palette.some((c) => c.role === 'BG_DARK'));
});

test('Phase 2: Typography Analyzer respects confidence boundaries for SVG with and without font-family', async () => {
  const svgNoFont = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100" fill="#111827"/><text x="20" y="60" fill="#FFFFFF">ACME</text></svg>',
    'utf8'
  );
  const analysisNoFont = await analyzeLogoBuffer(svgNoFont, 'image/svg+xml');
  const typoNoFont = await analyzeTypography(svgNoFont, 'image/svg+xml', analysisNoFont);
  assert.equal(typoNoFont.extractedText, 'ACME');
  assert.ok(typoNoFont.identificationConfidence < 0.6);
  assert.match(typoNoFont.confidenceNote, /exact typeface identification is not claimed/i);

  const svgWithFont = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="20" y="60" font-family="Playfair Display">LUXE</text></svg>',
    'utf8'
  );
  const analysisWithFont = await analyzeLogoBuffer(svgWithFont, 'image/svg+xml');
  const typoWithFont = await analyzeTypography(svgWithFont, 'image/svg+xml', analysisWithFont);
  assert.equal(typoWithFont.detectedStyle, 'serif');
  assert.equal(typoWithFont.headingFont, 'Playfair Display');
  assert.ok(typoWithFont.identificationConfidence >= 0.85);
});

test('Phase 2: HeuristicPersonalityAdapter builds complete personality profile', async () => {
  const svgBuf = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="90" fill="#2563EB"/></svg>',
    'utf8'
  );
  const logoAnalysis = await analyzeLogoBuffer(svgBuf, 'image/svg+xml');
  const palette = buildBrandColorPalette(logoAnalysis.extractedColors, logoAnalysis.backgroundType);
  const typography = await analyzeTypography(svgBuf, 'image/svg+xml', logoAnalysis);
  const personality = await new HeuristicPersonalityAdapter().generate({
    brandName: 'NovaForge',
    industry: 'AI Software',
    logoAnalysis,
    palette,
    typography,
  });
  assert.ok(personality.personalityTraits.length >= 3);
  assert.ok(personality.visualStyle.length > 5);
  assert.ok(personality.brandPositioning.includes('NovaForge'));
  assert.ok(personality.designRules.length >= 1);
});
