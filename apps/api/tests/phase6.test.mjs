import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const SAMPLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="32" fill="#0F172A"/><circle cx="128" cy="128" r="72" fill="#2563EB"/><text x="128" y="138" text-anchor="middle" fill="#FFFFFF" font-family="Inter" font-size="28">OV</text></svg>',
  'utf8'
);

test('Phase 6: Automatic, Semi-Automatic, Batch, Quality Control & 14-Folder Commercial Export', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase6-'));
  const dbPath = path.join(tmpDir, 'phase6.db');
  const storageDir = path.join(tmpDir, 'storage');
  await fs.mkdir(storageDir, { recursive: true });

  // Point Prisma & Storage to isolated test directory before importing services
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.STORAGE_ROOT = storageDir;

  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((d) => path.join(migrationsDir, d, 'migration.sql'));

  const pyMigrate = `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.execute("PRAGMA foreign_keys = ON;")
for p in sys.argv[2:]:
    with open(p, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
conn.commit()
`;
  execFileSync('python3', ['-c', pyMigrate, dbPath, ...migrationFiles]);

  const { prisma } = await import('../dist/db/client.js');
  const { LocalStorageService } = await import('../dist/services/storage.service.js');
  const { WorkflowAutomationService, PIPELINE_STAGES } = await import(
    '../dist/modules/automation/workflow.service.js'
  );
  const { BatchGenerationService } = await import('../dist/modules/automation/batch.service.js');
  const { CommercialExportService } = await import(
    '../dist/modules/automation/commercialExport.service.js'
  );

  try {
    assert.equal(PIPELINE_STAGES.length, 13);

    const storage = new LocalStorageService(storageDir);
    const project = await prisma.project.create({
      data: {
        name: 'Overthinker Test Brand',
        slug: 'overthinker-test-brand',
        industry: 'Creative AI Software',
        description: 'Automated test brand for Phase 6 verification.',
      },
    });

    const savedLogo = await storage.saveOriginalLogo({
      projectId: project.id,
      logoId: 'logo_master_1',
      buffer: SAMPLE_SVG,
      mimeType: 'image/svg+xml',
      originalFilename: 'master-logo.svg',
    });

    await prisma.logoAsset.create({
      data: {
        id: 'logo_master_1',
        projectId: project.id,
        originalFilename: 'master-logo.svg',
        storedFilename: savedLogo.storedFilename,
        mimeType: 'image/svg+xml',
        fileSize: savedLogo.fileSize,
        sha256: savedLogo.sha256,
        storagePath: savedLogo.storagePath,
        width: 256,
        height: 256,
        isOriginal: true,
        isPrimary: true,
      },
    });

    const wfService = new WorkflowAutomationService();

    // 1. Automatic Mode end-to-end 13-stage execution
    const autoWf = await wfService.createWorkflow(project.id, {
      mode: 'AUTOMATIC',
      config: { preferredConceptCategory: 'ORIGINAL_EVOLUTION', provider: 'heuristic' },
    });
    const completedWf = await wfService.runWorkflow(autoWf.id);
    assert.equal(completedWf?.status, 'COMPLETED');
    assert.equal(
      completedWf?.steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'),
      true
    );

    // Verify Quality & Consistency reports + legal disclaimer
    const qReports = await prisma.qualityReport.findMany({ where: { projectId: project.id } });
    const cReports = await prisma.consistencyReport.findMany({ where: { projectId: project.id } });
    assert.ok(qReports.length >= 1);
    assert.ok(cReports.length >= 1);
    assert.match(qReports[0].disclaimer, /do not guarantee trademark safety/i);

    // Verify 14-folder Commercial Export ZIP integrity
    const exportService = new CommercialExportService();
    const pkgs = await exportService.listPackages(project.id);
    assert.ok(pkgs.length >= 1);
    assert.equal(pkgs[0].status, 'COMPLETED');
    const { buffer: zipBuf } = await exportService.downloadPackage(project.id, pkgs[0].id);
    const zipPath = path.join(tmpDir, 'out.zip');
    await fs.writeFile(zipPath, zipBuf);

    const zipEntriesRaw = execFileSync(
      'python3',
      ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist()))', zipPath],
      { encoding: 'utf8' }
    );
    const zipEntries = zipEntriesRaw.trim().split('\n');
    assert.ok(zipEntries.some((e) => e.startsWith('BrandPackage/01_Original_Logo/')));
    assert.ok(zipEntries.some((e) => e.startsWith('BrandPackage/02_Logo_System/')));
    assert.ok(zipEntries.some((e) => e.startsWith('BrandPackage/03_Color_System/')));
    assert.ok(zipEntries.some((e) => e.startsWith('BrandPackage/04_Typography/')));
    assert.ok(zipEntries.some((e) => e.startsWith('BrandPackage/11_Brand_Guidelines/')));
    assert.ok(zipEntries.includes('BrandPackage/14_Metadata/manifest.json'));

    // 2. Idempotency: re-running completed workflow does not duplicate assets
    const assetCountBefore = await prisma.brandAsset.count({ where: { projectId: project.id } });
    await wfService.runWorkflow(autoWf.id);
    const assetCountAfter = await prisma.brandAsset.count({ where: { projectId: project.id } });
    assert.equal(assetCountAfter, assetCountBefore);

    // 3. Semi-Automatic Mode checkpoints, approval, pause, and cancel
    const semiWf = await wfService.createWorkflow(project.id, { mode: 'SEMI_AUTOMATIC' });
    const pausedAtCheckpoint = await wfService.runWorkflow(semiWf.id);
    assert.equal(pausedAtCheckpoint?.status, 'WAITING_APPROVAL');
    const pendingApproval = pausedAtCheckpoint?.approvals.find((a) => a.status === 'PENDING');
    assert.ok(pendingApproval);
    assert.equal(pendingApproval.stepKey, 'brand_dna');

    const resumed = await wfService.decideCheckpoint(semiWf.id, pendingApproval.id, 'APPROVED', 'Looks good');
    assert.equal(resumed?.status, 'WAITING_APPROVAL'); // Pauses at next checkpoint (brand_concepts)

    const paused = await wfService.pauseWorkflow(semiWf.id);
    assert.equal(paused.status, 'PAUSED');
    const cancelled = await wfService.cancelWorkflow(semiWf.id);
    assert.equal(cancelled.status, 'CANCELLED');

    // 4. Batch Generation with bounded concurrency
    const batchService = new BatchGenerationService();
    const batchJob = await batchService.createAndRunBatch(project.id, {
      category: 'SOCIAL_MEDIA',
      outputCount: 3,
      width: 1080,
      height: 1080,
      concurrencyLimit: 2,
    });
    assert.equal(batchJob.status, 'COMPLETED');
    assert.equal(batchJob.progress, 100);
    const refs = JSON.parse(batchJob.outputRefsJson);
    assert.equal(refs.length, 3);

    // 5. Asset Locking & Original Logo Integrity
    const firstAsset = await prisma.brandAsset.findFirst({ where: { projectId: project.id } });
    assert.ok(firstAsset);
    const locked = await prisma.brandAsset.update({
      where: { id: firstAsset.id },
      data: { isApproved: true, isLocked: true },
    });
    assert.equal(locked.isLocked, true);

    const origDiskBytes = await storage.readLogo(savedLogo.storagePath);
    const origShaAfter = crypto.createHash('sha256').update(origDiskBytes).digest('hex');
    assert.equal(origShaAfter, savedLogo.sha256);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
