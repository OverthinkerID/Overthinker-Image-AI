import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { BrandPresentationsService } from '../presentations/presentations.service';
import { LogoSystemService } from '../design-engine/logoSystem.service';
import { TemplateEngineService } from '../design-engine/templateEngine.service';
import { MockupLibraryService } from '../mockups/mockupLibrary.service';
import { SmartMockupService } from '../mockups/smartMockup.service';

const logoSystem = new LogoSystemService();
const templateEngine = new TemplateEngineService();
const mockupLibrary = new MockupLibraryService();
const smartMockup = new SmartMockupService();
const presentations = new BrandPresentationsService();

export class BatchGenerationService {
  /**
   * Executes batch items with bounded concurrency (default = 1 sequential)
   * so local GPU/ComfyUI resources are never overwhelmed.
   */
  async createAndRunBatch(
    projectId: string,
    payload: {
      category: 'LOGO_VARIATION' | 'SOCIAL_MEDIA' | 'STATIONERY' | 'PACKAGING' | 'MARKETING' | 'MOCKUP' | 'PRESENTATION';
      outputCount?: number;
      width?: number;
      height?: number;
      conceptId?: string;
      provider?: string;
      model?: string;
      concurrencyLimit?: number;
      instructions?: string;
    }
  ) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

    const outputCount = Math.max(1, Math.min(20, payload.outputCount || 4));
    const concurrencyLimit = Math.max(1, Math.min(4, payload.concurrencyLimit || 1));

    const job = await prisma.batchGenerationJob.create({
      data: {
        projectId, category: payload.category, outputCount, width: payload.width || 1080, height: payload.height || 1080,
        conceptId: payload.conceptId || null, provider: payload.provider || 'heuristic', model: payload.model || null,
        concurrencyLimit, instructions: payload.instructions || null, status: 'RUNNING', progress: 0,
      },
    });

    try {
      const outputRefs: string[] = [];
      let completed = 0;

      const tasks = Array.from({ length: outputCount }, (_, idx) => async () => {
        if (payload.category === 'LOGO_VARIATION') {
          const vars = await logoSystem.generateVariationSet(projectId, { conceptId: payload.conceptId });
          if (vars[idx]) outputRefs.push(vars[idx].id);
        } else if (payload.category === 'MOCKUP') {
          const mks = await mockupLibrary.listMockupTemplates(projectId);
          const tpl = mks[idx % mks.length];
          if (tpl) {
            const m = await smartMockup.createMockupFromTemplate(projectId, { templateId: tpl.id, width: payload.width, height: payload.height, conceptId: payload.conceptId });
            outputRefs.push(m.id);
          }
        } else if (payload.category === 'PRESENTATION') {
          const p = await presentations.generatePresentation(projectId, payload.conceptId);
          outputRefs.push(p.id);
        } else {
          const tpls = await templateEngine.listTemplates(projectId, payload.category);
          const tpl = tpls[idx % tpls.length];
          if (tpl) {
            const doc = await templateEngine.instantiateTemplateForProject(projectId, tpl.id, { width: payload.width, height: payload.height, conceptId: payload.conceptId, title: `${project.name} · Batch #${idx + 1}` });
            outputRefs.push(doc.id);
          }
        }
        completed++;
        await prisma.batchGenerationJob.update({ where: { id: job.id }, data: { progress: Math.round((completed / outputCount) * 100) } });
      });

      // Bounded concurrency worker pool
      for (let i = 0; i < tasks.length; i += concurrencyLimit) {
        await Promise.all(tasks.slice(i, i + concurrencyLimit).map((fn) => fn()));
      }

      return prisma.batchGenerationJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', progress: 100, outputRefsJson: JSON.stringify(outputRefs), completedAt: new Date() },
      });
    } catch (err) {
      return prisma.batchGenerationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Batch failed', completedAt: new Date() },
      });
    }
  }

  async listBatchJobs(projectId: string) {
    return prisma.batchGenerationJob.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }
}
