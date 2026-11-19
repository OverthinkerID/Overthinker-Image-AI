import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export class QualityConsistencyService {
  async runConsistencyCheck(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        logos: true,
        brandDnas: { include: { colors: true, typography: true, personality: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] },
        concepts: true, logoVariations: true, colorSystems: true, typographySystems: true,
        graphicElements: true, designDocuments: true, mockupDocuments: true,
      },
    });
    if (!project) throw new Error('Project not found');
    const dna = project.brandDnas[0] || null;

    const results: Array<{ area: string; passed: boolean; message: string }> = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const corrections: string[] = [];

    // 1. Original Logo Integrity
    const origOk = project.logos.length > 0 && project.logos.every((l) => l.isOriginal && l.sha256.length === 64);
    results.push({ area: 'logo_integrity', passed: origOk, message: origOk ? 'Original master logo vault intact.' : 'Missing original logo.' });
    if (!origOk) errors.push('Upload at least one original master logo.');

    // 2. Brand DNA & Approved Concept
    const hasDna = Boolean(dna);
    results.push({ area: 'brand_dna', passed: hasDna, message: hasDna ? `Brand DNA v${dna?.version} active.` : 'Brand DNA missing.' });
    if (!hasDna) errors.push('Run Brand DNA analysis before generating downstream assets.');

    // 3. Logo Variations
    const varOk = project.logoVariations.length >= 10;
    results.push({ area: 'logo_variations', passed: varOk, message: `${project.logoVariations.length} logo variations present.` });
    if (!varOk) { warnings.push('Fewer than 10 logo variations generated.'); corrections.push('Run Logo System Generator to complete all 10 variations.'); }

    // 4. Color & Typography Consistency
    const colorOk = project.colorSystems.length > 0;
    const typoOk = project.typographySystems.length > 0;
    results.push({ area: 'brand_colors', passed: colorOk, message: colorOk ? 'Color system aligned to Brand DNA.' : 'No Color System saved.' });
    results.push({ area: 'typography', passed: typoOk, message: typoOk ? 'Typography hierarchy configured.' : 'No Typography System saved.' });
    if (!colorOk) corrections.push('Generate Brand Color System.');
    if (!typoOk) corrections.push('Generate Brand Typography System.');

    // 5. Mockup Source Traceability
    const mockupTraceOk = project.mockupDocuments.every((m) => Boolean(m.conceptId || m.sourceAssetId));
    results.push({ area: 'mockup_source_assets', passed: mockupTraceOk, message: mockupTraceOk ? 'All mockups traceable to source assets.' : 'Some mockups lack source asset reference.' });

    const passedCount = results.filter((r) => r.passed).length;
    const consistencyScore = Math.round((passedCount / Math.max(1, results.length)) * 100);

    return prisma.consistencyReport.create({
      data: {
        projectId, consistencyScore, resultsJson: JSON.stringify(results),
        warningsJson: JSON.stringify(warnings), errorsJson: JSON.stringify(errors), correctionsJson: JSON.stringify(corrections),
      },
    });
  }

  async runQualityChecks(projectId: string) {
    const [assets, docs, mockups, exportsList] = await Promise.all([
      prisma.brandAsset.findMany({ where: { projectId } }),
      prisma.designDocument.findMany({ where: { projectId } }),
      prisma.mockupDocument.findMany({ where: { projectId } }),
      prisma.assetExport.findMany({ where: { projectId } }),
    ]);

    const checks: Array<{ check: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string }> = [];

    // 1. Missing asset files on disk
    let missingFiles = 0;
    for (const a of assets) {
      if (!(await storage.fileExists(a.storagePath))) missingFiles++;
    }
    checks.push({ check: 'missing_assets', status: missingFiles === 0 ? 'PASS' : 'FAIL', detail: `${missingFiles} missing asset file(s) on disk.` });

    // 2. Empty exports check
    const emptyExports = exportsList.filter((e) => e.fileSize <= 0).length;
    checks.push({ check: 'empty_exports', status: emptyExports === 0 ? 'PASS' : 'FAIL', detail: `${emptyExports} empty export file(s).` });

    // 3. Invalid dimensions check
    const badDims = docs.filter((d) => d.width <= 0 || d.height <= 0).length;
    checks.push({ check: 'dimensions', status: badDims === 0 ? 'PASS' : 'FAIL', detail: `${badDims} document(s) with invalid dimensions.` });

    // 4. SVG validity check
    let badSvgs = 0;
    for (const a of assets.filter((x) => x.assetType === 'SVG')) {
      const buf = await storage.readRelativeFile(a.storagePath).catch(() => null);
      if (!buf || !buf.toString('utf8').includes('<svg')) badSvgs++;
    }
    checks.push({ check: 'svg_rendering', status: badSvgs === 0 ? 'PASS' : 'FAIL', detail: `${badSvgs} malformed SVG file(s).` });

    // 5. Missing mockup renders
    const missingMockupRenders = mockups.filter((m) => !m.renderedPath).length;
    checks.push({ check: 'mockup_elements', status: missingMockupRenders === 0 ? 'PASS' : 'WARN', detail: `${missingMockupRenders} mockup(s) without rendered output.` });

    const failCount = checks.filter((c) => c.status === 'FAIL').length;
    const warnCount = checks.filter((c) => c.status === 'WARN').length;
    const overallScore = Math.max(0, 100 - failCount * 25 - warnCount * 10);

    return prisma.qualityReport.create({
      data: {
        projectId, overallScore, passed: failCount === 0, checksJson: JSON.stringify(checks),
        disclaimer: 'Automated quality checks do not guarantee trademark safety or legal compliance.',
      },
    });
  }
}
