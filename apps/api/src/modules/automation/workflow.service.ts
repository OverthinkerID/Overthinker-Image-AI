import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { BrandDnaService } from '../brand-dna/brandDna.service';
import { ConceptsService } from '../concepts/concepts.service';
import { ColorSystemService } from '../design-engine/colorSystem.service';
import { GraphicElementsService } from '../design-engine/graphicElements.service';
import { LogoSystemService } from '../design-engine/logoSystem.service';
import { TemplateEngineService } from '../design-engine/templateEngine.service';
import { TypographySystemService } from '../design-engine/typographySystem.service';
import { BrandGuidelinesService } from '../guidelines/guidelines.service';
import { MockupLibraryService } from '../mockups/mockupLibrary.service';
import { SmartMockupService } from '../mockups/smartMockup.service';
import { CommercialExportService } from './commercialExport.service';
import { QualityConsistencyService } from './qualityConsistency.service';

export type OperationMode = 'AUTOMATIC' | 'SEMI_AUTOMATIC' | 'MANUAL';

export const PIPELINE_STAGES = [
  { stepKey: 'logo_analysis', name: '1. Logo Analysis', isOptional: false, semiAutoCheckpoint: false },
  { stepKey: 'brand_dna', name: '2. Brand DNA Generation', isOptional: false, semiAutoCheckpoint: true },
  { stepKey: 'brand_concepts', name: '3. Four Brand Concepts', isOptional: false, semiAutoCheckpoint: true },
  { stepKey: 'concept_selection', name: '4. Concept Selection (Configurable Rules)', isOptional: false, semiAutoCheckpoint: false },
  { stepKey: 'logo_system', name: '5. Logo System Generation', isOptional: false, semiAutoCheckpoint: true },
  { stepKey: 'color_system', name: '6. Color System Generation', isOptional: false, semiAutoCheckpoint: false },
  { stepKey: 'typography_system', name: '7. Typography System Generation', isOptional: false, semiAutoCheckpoint: true },
  { stepKey: 'iconography_patterns', name: '8. Iconography & Patterns', isOptional: true, semiAutoCheckpoint: false },
  { stepKey: 'templates', name: '9. Template Generation', isOptional: true, semiAutoCheckpoint: true },
  { stepKey: 'mockups', name: '10. Mockup Generation', isOptional: true, semiAutoCheckpoint: true },
  { stepKey: 'brand_guidelines', name: '11. Brand Guidelines Generation', isOptional: false, semiAutoCheckpoint: true },
  { stepKey: 'quality_control', name: '12. Quality & Consistency Control', isOptional: false, semiAutoCheckpoint: false },
  { stepKey: 'commercial_export', name: '13. Commercial Export Package', isOptional: false, semiAutoCheckpoint: false },
] as const;

const brandDnaService = new BrandDnaService();
const conceptsService = new ConceptsService();
const logoSystem = new LogoSystemService();
const colorSystem = new ColorSystemService();
const typoSystem = new TypographySystemService();
const graphicElements = new GraphicElementsService();
const templateEngine = new TemplateEngineService();
const mockupLibrary = new MockupLibraryService();
const smartMockup = new SmartMockupService();
const guidelinesService = new BrandGuidelinesService();
const qcService = new QualityConsistencyService();
const commercialExport = new CommercialExportService();

export class WorkflowAutomationService {
  async createWorkflow(projectId: string, payload: { name?: string; mode: OperationMode; config?: Record<string, unknown> }) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const wfId = `wf_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    return prisma.automationWorkflow.create({
      data: {
        id: wfId, projectId, name: payload.name || `${project.name} · ${payload.mode} Pipeline`,
        mode: payload.mode, status: 'QUEUED', configJson: JSON.stringify(payload.config || { preferredConceptCategory: 'ORIGINAL_EVOLUTION', provider: 'heuristic' }),
        steps: {
          create: PIPELINE_STAGES.map((st, idx) => ({
            stepOrder: idx, stepKey: st.stepKey, name: st.name, isOptional: st.isOptional,
            requiresApproval: payload.mode === 'SEMI_AUTOMATIC' && st.semiAutoCheckpoint,
            idempotencyKey: `${wfId}:${st.stepKey}`, status: 'QUEUED',
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true, executions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  async listWorkflows(projectId: string) {
    return prisma.automationWorkflow.findMany({
      where: { projectId },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true, executions: { orderBy: { createdAt: 'desc' }, take: 15 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async log(workflowId: string, stepKey: string, level: 'INFO' | 'WARN' | 'ERROR', message: string, meta: Record<string, unknown> = {}) {
    await prisma.workflowExecution.create({ data: { workflowId, stepKey, level, message, metaJson: JSON.stringify(meta) } });
  }

  async runWorkflow(workflowId: string) {
    const wf = await prisma.automationWorkflow.findUnique({ where: { id: workflowId }, include: { steps: { orderBy: { stepOrder: 'asc' } } } });
    if (!wf) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found.');
    if (wf.status === 'CANCELLED') throw new AppError(409, 'WORKFLOW_CANCELLED', 'Cancelled workflows cannot be resumed.');

    await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'RUNNING', startedAt: wf.startedAt || new Date() } });
    const config = JSON.parse(wf.configJson || '{}') as { preferredConceptCategory?: string; provider?: string };

    for (const step of wf.steps) {
      const freshWf = await prisma.automationWorkflow.findUnique({ where: { id: wf.id } });
      if (!freshWf || freshWf.status === 'PAUSED' || freshWf.status === 'CANCELLED') return freshWf;

      // Idempotency guard: never re-run or duplicate already completed/skipped steps
      if (step.status === 'COMPLETED' || step.status === 'SKIPPED') continue;

      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'RUNNING', attempts: step.attempts + 1, startedAt: new Date(), errorMessage: null } });
      await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { currentStepIdx: step.stepOrder } });

      try {
        const output = await this.executeStep(wf.projectId, step.stepKey, config);
        if (step.requiresApproval) {
          await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'WAITING_APPROVAL', outputJson: JSON.stringify(output) } });
          await prisma.workflowApproval.create({ data: { workflowId: wf.id, stepKey: step.stepKey, status: 'PENDING' } });
          await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'WAITING_APPROVAL' } });
          await this.log(wf.id, step.stepKey, 'INFO', `Paused at checkpoint for user approval: ${step.name}`);
          return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true, executions: { orderBy: { createdAt: 'desc' }, take: 20 } } });
        }
        await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(output), completedAt: new Date() } });
        await this.log(wf.id, step.stepKey, 'INFO', `Completed ${step.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Step execution failed';
        await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'FAILED', errorMessage: msg } });
        await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'FAILED' } });
        await this.log(wf.id, step.stepKey, 'ERROR', `Failed ${step.name}: ${msg}`);
        return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true, executions: { orderBy: { createdAt: 'desc' }, take: 20 } } });
      }
    }

    await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true, executions: { orderBy: { createdAt: 'desc' }, take: 20 } } });
  }

  private async executeStep(projectId: string, stepKey: string, config: { preferredConceptCategory?: string; provider?: string }) {
    const provider = config.provider || 'heuristic';
    switch (stepKey) {
      case 'logo_analysis':
      case 'brand_dna': {
        const existing = await brandDnaService.getProjectBrandDnas(projectId);
        if (existing.versions.length > 0 && stepKey === 'brand_dna') return { brandDnaId: existing.versions[0].id };
        const res = await brandDnaService.analyzeAndBuildBrandDna(projectId, { provider: provider as 'heuristic' });
        return { analysisId: res.analysis.id, brandDnaId: res.brandDna.id };
      }
      case 'brand_concepts': {
        const res = await conceptsService.generateFourConcepts(projectId, { provider });
        return { count: res.concepts.length, jobId: res.job.id };
      }
      case 'concept_selection': {
        const concepts = await conceptsService.listConcepts(projectId);
        const preferred = concepts.find((c) => c.categoryKey === (config.preferredConceptCategory || 'ORIGINAL_EVOLUTION')) || concepts[0];
        if (preferred && !preferred.isPrimary) await prisma.brandConcept.update({ where: { id: preferred.id }, data: { isPrimary: true } });
        return { selectedConceptId: preferred?.id || null, note: 'Selected via configurable rule; user review recommended before legal/trademark commitment.' };
      }
      case 'logo_system': { const vars = await logoSystem.generateVariationSet(projectId); return { count: vars.length }; }
      case 'color_system': { const cs = await colorSystem.generateOrGetColorSystem(projectId); return { colorSystemId: cs.id }; }
      case 'typography_system': { const ts = await typoSystem.generateOrGetTypographySystem(projectId); return { typographySystemId: ts.id }; }
      case 'iconography_patterns': { const elems = await graphicElements.generateElementSet(projectId, { format: 'SVG' }); return { count: elems.length }; }
      case 'templates': {
        const tpls = await templateEngine.listTemplates(projectId);
        if (tpls[0]) { const doc = await templateEngine.instantiateTemplateForProject(projectId, tpls[0].id); return { documentId: doc.id }; }
        return { skipped: true };
      }
      case 'mockups': {
        const mks = await mockupLibrary.listMockupTemplates(projectId);
        if (mks[0]) { const m = await smartMockup.createMockupFromTemplate(projectId, { templateId: mks[0].id }); return { mockupId: m.id }; }
        return { skipped: true };
      }
      case 'brand_guidelines': { const g = await guidelinesService.generateGuidelines(projectId); return { guidelineId: g.id }; }
      case 'quality_control': {
        const [q, c] = await Promise.all([qcService.runQualityChecks(projectId), qcService.runConsistencyCheck(projectId)]);
        return { qualityScore: q.overallScore, consistencyScore: c.consistencyScore };
      }
      case 'commercial_export': { const pkg = await commercialExport.buildCommercialPackage(projectId); return { packageId: pkg.id, fileSize: pkg.fileSize }; }
      default: return {};
    }
  }

  async pauseWorkflow(workflowId: string) {
    return prisma.automationWorkflow.update({ where: { id: workflowId }, data: { status: 'PAUSED' }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
  }
  async cancelWorkflow(workflowId: string) {
    return prisma.automationWorkflow.update({ where: { id: workflowId }, data: { status: 'CANCELLED', completedAt: new Date() }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
  }
  async skipStep(workflowId: string, stepKey: string) {
    await prisma.workflowStep.updateMany({ where: { workflowId, stepKey, isOptional: true }, data: { status: 'SKIPPED', completedAt: new Date() } });
    return this.runWorkflow(workflowId);
  }
  async retryStep(workflowId: string, stepKey: string) {
    await prisma.workflowStep.updateMany({ where: { workflowId, stepKey, status: 'FAILED' }, data: { status: 'QUEUED', errorMessage: null } });
    return this.runWorkflow(workflowId);
  }
  async restartFromStep(workflowId: string, stepOrder: number) {
    await prisma.workflowStep.updateMany({ where: { workflowId, stepOrder: { gte: stepOrder } }, data: { status: 'QUEUED', errorMessage: null } });
    return this.runWorkflow(workflowId);
  }
  async decideCheckpoint(workflowId: string, approvalId: string, decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED', comment?: string) {
    const approval = await prisma.workflowApproval.update({ where: { id: approvalId }, data: { status: decision, comment: comment || null, decidedAt: new Date() } });
    if (decision === 'APPROVED') {
      await prisma.workflowStep.updateMany({ where: { workflowId, stepKey: approval.stepKey }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await this.log(workflowId, approval.stepKey, 'INFO', `Checkpoint approved: ${comment || 'OK'}`);
      return this.runWorkflow(workflowId);
    }
    await prisma.automationWorkflow.update({ where: { id: workflowId }, data: { status: 'PAUSED' } });
    await this.log(workflowId, approval.stepKey, 'WARN', `Checkpoint ${decision}: ${comment || ''}`);
    return prisma.automationWorkflow.findUnique({ where: { id: workflowId }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
  }
}
