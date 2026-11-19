import assert from 'node:assert/strict';
import test from 'node:test';
import { computeWcagContrast, enrichHexColor, rgbToCmyk } from '../dist/modules/design-engine/colorSystem.service.js';
import { fabricJsonToSvg } from '../dist/modules/design-engine/exportEngine.service.js';

test('Phase 4: Color System calculates CMYK approximation and WCAG AA/AAA contrast', () => {
  const cmyk = rgbToCmyk(37, 99, 235);
  assert.match(cmyk, /^cmyk\(\d+%, \d+%, \d+%, \d+%\)$/);

  const swatch = enrichHexColor('primary', 'Brand Blue', '#2563EB');
  assert.equal(swatch.hex, '#2563EB');
  assert.equal(swatch.rgb, 'rgb(37, 99, 235)');
  assert.ok(swatch.hsl.startsWith('hsl('));

  const highContrast = computeWcagContrast('#FFFFFF', '#0F172A');
  assert.ok(highContrast.ratio >= 15);
  assert.equal(highContrast.aaNormal, true);
  assert.equal(highContrast.aaaNormal, true);

  const lowContrast = computeWcagContrast('#CBD5E1', '#FFFFFF');
  assert.equal(lowContrast.aaNormal, false);
});

test('Phase 4: Fabric.js JSON exports cleanly to SVG with background and vector primitives', () => {
  const canvasJson = JSON.stringify({
    background: '#0F172A',
    objects: [
      { type: 'rect', left: 20, top: 20, width: 200, height: 80, rx: 12, fill: '#2563EB' },
      { type: 'circle', left: 300, top: 40, radius: 30, fill: '#38BDF8' },
      { type: 'textbox', left: 40, top: 140, fontSize: 28, fontWeight: 'bold', fontFamily: 'Inter', fill: '#FFFFFF', text: 'Overthinker' },
    ],
  });

  const svg = fabricJsonToSvg(canvasJson, 800, 600, false);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('fill="#0F172A"'));
  assert.ok(svg.includes('fill="#2563EB"'));
  assert.ok(svg.includes('<circle '));
  assert.ok(svg.includes('Overthinker</text>'));

  const transparentSvg = fabricJsonToSvg(canvasJson, 800, 600, true);
  assert.ok(!transparentSvg.includes('width="800" height="600" fill="#0F172A"'));
});
