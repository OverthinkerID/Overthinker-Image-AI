import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMockupSceneSvg } from '../dist/modules/mockups/smartMockup.service.js';

test('Phase 5: Smart Mockup Engine renders customizable SVG scene with transform, colors, and copy', () => {
  const svg = renderMockupSceneSvg({
    width: 1200,
    height: 900,
    templateName: 'Business Card',
    category: 'STATIONERY',
    brandName: 'Overthinker Studio',
    scene: {
      logoX: 600,
      logoY: 360,
      logoScale: 1.2,
      logoRotation: 15,
      objectColor: '#1E293B',
      backgroundColor: '#0B1120',
      headlineText: 'Overthinker Studio',
      subtext: 'AI Brand Identity',
      skewDeg: -4,
    },
  });

  assert.ok(svg.includes('width="1200" height="900"'));
  assert.ok(svg.includes('translate(600, 360) rotate(15) scale(1.2) skewX(-4)'));
  assert.ok(svg.includes('fill="#1E293B"'));
  assert.ok(svg.includes('fill="#0B1120"'));
  assert.ok(svg.includes('STATIONERY · BUSINESS CARD'));
  assert.ok(svg.includes('Overthinker Studio'));
});
