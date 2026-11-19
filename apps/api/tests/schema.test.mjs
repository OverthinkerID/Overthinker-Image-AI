import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('Prisma SQLite migrations create all Phase 1-6 tables and enforce foreign key cascades', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-schema-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');

  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    const migrationDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    assert.ok(migrationDirs.length >= 6, `Expected at least 6 migrations, found ${migrationDirs.length}`);

    const pythonScript = `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.execute("PRAGMA foreign_keys = ON;")
for path_arg in sys.argv[2:]:
    with open(path_arg, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
print(",".join(tables))
conn.execute("""INSERT INTO "Project" ("id", "name", "slug", "createdAt", "updatedAt") VALUES ('p1', 'Test Brand', 'test-brand', datetime('now'), datetime('now'))""")
conn.execute("""INSERT INTO "LogoAsset" ("id", "projectId", "originalFilename", "storedFilename", "storagePath", "mimeType", "fileSize", "sha256", "isPrimary") VALUES ('l1', 'p1', 'logo.png', 'l1.png', 'projects/p1/logos/originals/l1.png', 'image/png', 100, 'abc', 1)""")
conn.execute("""DELETE FROM "Project" WHERE "id" = 'p1'""")
remaining = conn.execute("""SELECT COUNT(*) FROM "LogoAsset" WHERE "id" = 'l1'""").fetchone()[0]
print(f"REMAINING={remaining}")
`;
    const migrationFiles = migrationDirs.map((d) => path.join(migrationsDir, d, 'migration.sql'));
    const output = execFileSync('python3', ['-c', pythonScript, dbPath, ...migrationFiles], {
      encoding: 'utf8',
    });

    const lines = output.trim().split('\n');
    const tables = lines[0].split(',');
    const expectedTables = [
      'Project',
      'LogoAsset',
      'brand_dna',
      'brand_concepts',
      'ai_provider_configs',
      'ai_jobs',
      'brand_assets',
      'mockup_templates',
      'mockup_documents',
      'brand_guidelines',
      'automation_workflows',
      'workflow_steps',
      'workflow_executions',
      'workflow_approvals',
      'batch_generation_jobs',
      'quality_reports',
      'consistency_reports',
      'asset_approvals',
      'export_packages',
      'export_package_items',
    ];
    for (const tbl of expectedTables) {
      assert.ok(tables.includes(tbl), `Missing expected table: ${tbl}`);
    }
    assert.ok(lines.includes('REMAINING=0'), 'Cascade delete on Project -> LogoAsset failed');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
