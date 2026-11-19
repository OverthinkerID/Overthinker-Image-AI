import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCategoryPrompt, CONCEPT_CATEGORIES } from '../dist/modules/concepts/prompt.engine.js';
import { interpolateWorkflowTemplate } from '../dist/modules/ai/comfyui.service.js';

test('Phase 3: Prompt Engineering Engine builds distinct prompts for all 4 concept categories', () => {
  const ctx = {
    brandName: 'Vortex Labs',
    industry: 'Robotics',
    personalityTraits: ['Precision-Driven', 'Futuristic'],
    visualStyle: 'Minimalist Geometric',
    visualDirection: 'Clean modular symmetry',
    colors: [
      { role: 'PRIMARY', hex: '#2563EB' },
      { role: 'SECONDARY', hex: '#0F172A' },
      { role: 'ACCENT', hex: '#38BDF8' },
    ],
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
    targetAudience: 'Enterprise engineering teams',
    designRules: ['Preserve master mark proportions'],
  };

  assert.equal(CONCEPT_CATEGORIES.length, 4);
  const prompts = CONCEPT_CATEGORIES.map((cat) => buildCategoryPrompt(ctx, cat));
  const names = new Set(prompts.map((p) => p.conceptName));
  assert.equal(names.size, 4);
  for (const p of prompts) {
    assert.ok(p.prompt.includes('Vortex Labs'));
    assert.ok(p.prompt.includes('#2563EB'));
    assert.ok(p.negativePrompt.length > 10);
  }
});

test('Phase 3: ComfyUI interpolateWorkflowTemplate substitutes placeholders without hardcoded model params', () => {
  const template = JSON.stringify({
    '3': { inputs: { seed: '{{seed}}', steps: '{{steps}}', cfg: '{{cfg}}' } },
    '4': { inputs: { ckpt_name: '{{model}}' } },
    '5': { inputs: { width: '{{width}}', height: '{{height}}' } },
    '6': { inputs: { text: '{{prompt}}' } },
    '7': { inputs: { text: '{{negative_prompt}}' } },
  });

  const graph = interpolateWorkflowTemplate(template, {
    prompt: 'Luxury brand "Vortex" stationery',
    negativePrompt: 'blurry, watermark',
    model: 'custom_flux_dev.safetensors',
    seed: 123456,
    steps: 30,
    cfg: 6.5,
    width: 1280,
    height: 720,
  });

  assert.equal(graph['3'].inputs.seed, 123456);
  assert.equal(graph['3'].inputs.steps, 30);
  assert.equal(graph['4'].inputs.ckpt_name, 'custom_flux_dev.safetensors');
  assert.equal(graph['5'].inputs.width, 1280);
  assert.equal(graph['5'].inputs.height, 720);
  assert.ok(String(graph['6'].inputs.text).includes('Luxury brand'));
});
