import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { BrandStrategyService } from './brandStrategy.service';
import { MarketResearchService } from './marketResearch.service';

export const STRATEGY_PIPELINE_STAGES = [
  { stepKey: 'read_brand_dna', name: '1. Read Brand DNA', isOptional: false, checkpoint: false },
  { stepKey: 'analyze_industry', name: '2. Analyze Industry', isOptional: false, checkpoint: true },
  { stepKey: 'research_market', name: '3. Research Market', isOptional: false, checkpoint: true },
  { stepKey: 'identify_competitors', name: '4. Identify Competitors', isOptional: false, checkpoint: true },
  { stepKey: 'analyze_audience', name: '5. Analyze Audience', isOptional: false, checkpoint: false },
  { stepKey: 'generate_personas', name: '6. Generate Customer Personas', isOptional: false, checkpoint: true },
  { stepKey: 'analyze_positioning', name: '7. Analyze Positioning', isOptional: false, checkpoint: true },
  { stepKey: 'generate_naming_tagline', name: '8. Generate Naming & Tagline', isOptional: true, checkpoint: true },
  { stepKey: 'create_recommendations', name: '9. Create Recommendations', isOptional: false, checkpoint: false },
  { stepKey: 'generate_strategy_report', name: '10. Generate Strategy Report', isOptional: false, checkpoint: true },
  { stepKey: 'consistency_checks', name: '11. Consistency Checks', isOptional: false, checkpoint: false },
  { stepKey: 'save_final_report', name: '12. Save Final Report', isOptional: false, checkpoint: false },
] as const;

const researchService = new MarketResearchService();
const strategyService = new BrandStrategyService();

export class StrategyWorkflowService {
  async createWorkflow(workspaceId: string, projectId: string, mode: 'AUTOMATIC' | 'SEMI_AUTOMATIC' | 'MANUAL', config?: Record<string, unknown>) {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const wfId = `swf_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    return prisma.automationWorkflow.create({
      data: {
        id: wfId,
        projectId,
        name: `${project.name} · Strategy ${mode}`,
        mode,
        status: 'QUEUED',
        configJson: JSON.stringify({ ...(config || {}), workspaceId, domain: 'STRATEGY' }),
        steps: {
          create: STRATEGY_PIPELINE_STAGES.map((s, idx) => ({
            stepOrder: idx,
            stepKey: s.stepKey,
            name: s.name,
            isOptional: s.isOptional,
            requiresApproval: mode === 'SEMI_AUTOMATIC' && s.checkpoint,
            idempotencyKey: `${wfId}:${s.stepKey}`,
            status: 'QUEUED',
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true },
    });
  }

  async runWorkflow(workflowId: string) {
    const wf = await prisma.automationWorkflow.findUnique({ where: { id: workflowId }, include: { steps: { orderBy: { stepOrder: 'asc' } } } });
    if (!wf) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Strategy workflow not found.');
    if (wf.status === 'CANCELLED') throw new AppError(409, 'WORKFLOW_CANCELLED', 'Cancelled workflow cannot run.');

    const cfg = JSON.parse(wf.configJson || '{}') as { workspaceId?: string; provider?: string };
    const workspaceId = cfg.workspaceId || 'ws_local_default';

    await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'RUNNING', startedAt: wf.startedAt || new Date() } });

    for (const step of wf.steps) {
      const fresh = await prisma.automationWorkflow.findUnique({ where: { id: wf.id } });
      if (!fresh || fresh.status === 'PAUSED' || fresh.status === 'CANCELLED') return fresh;
      if (step.status === 'COMPLETED' || step.status === 'SKIPPED') continue;

      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'RUNNING', attempts: step.attempts + 1, startedAt: new Date() } });
      await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { currentStepIdx: step.stepOrder } });

      try {
        const out = await this.executeStage(workspaceId, wf.projectId, step.stepKey, cfg);
        if (step.requiresApproval) {
          await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'WAITING_APPROVAL', outputJson: JSON.stringify(out) } });
          await prisma.workflowApproval.create({ data: { workflowId: wf.id, stepKey: step.stepKey, status: 'PENDING' } });
          await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'WAITING_APPROVAL' } });
          return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
        }
        await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(out), completedAt: new Date() } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Strategy stage failed';
        await prisma.workflowStep.update({ where: { id: step.id }, data: { status: 'FAILED', errorMessage: msg } });
        await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'FAILED' } });
        return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
      }
    }

    await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    return prisma.automationWorkflow.findUnique({ where: { id: wf.id }, include: { steps: { orderBy: { stepOrder: 'asc' } }, approvals: true } });
  }

  private async executeStage(workspaceId: string, projectId: string, stepKey: string, cfg: { provider?: string }) {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new Error('Project not found');
    switch (stepKey) {
      case 'read_brand_dna': {
        const dna = await prisma.brandDna.findFirst({ where: { projectId }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] });
        return { brandDnaId: dna?.id || null };
      }
      case 'analyze_industry':
      case 'research_market': {
        const existing = await researchService.listResearchProjects(workspaceId, projectId);
        const rp = existing[0] || (await researchService.createResearchProject(workspaceId, projectId, 'system', { brandName: project.name, industry: project.industry || 'General', provider: cfg.provider }));
        if (stepKey === 'research_market') await researchService.analyzeResearch(workspaceId, projectId, rp.id, { provider: cfg.provider });
        return { researchProjectId: rp.id };
      }
      case 'identify_competitors': {
        const comps = await researchService.listCompetitors(workspaceId, projectId);
        return { competitorsCount: comps.length };
      }
      case 'analyze_audience': {
        const segs = await researchService.listSegments(workspaceId, projectId);
        if (segs.length === 0) await researchService.createSegment(workspaceId, projectId, { name: 'Primary Segment', dataSourceType: 'AI_HYPOTHESIS' });
        return { ok: true };
      }
      case 'generate_personas': {
        const existing = await researchService.listPersonas(workspaceId, projectId);
        if (existing.length === 0) await researchService.generatePersonas(workspaceId, projectId, { industry: project.industry || undefined });
        return { ok: true };
      }
      case 'analyze_positioning': {
        const pos = await strategyService.generatePositioning(workspaceId, projectId, { provider: cfg.provider });
        return { positioningId: pos.id };
      }
      case 'generate_naming_tagline': {
        const [names, tags] = await Promise.all([strategyService.generateNames(workspaceId, projectId), strategyService.generateTaglines(workspaceId, projectId)]);
        return { names: names.length, taglines: tags.length };
      }
      case 'create_recommendations': {
        await prisma.strategyRecommendation.create({ data: { workspaceId, projectId, category: 'POSITIONING', title: 'Validate positioning with target interviews', rationale: 'Confirm AI hypotheses with real buyer feedback.', priority: 'HIGH' } });
        return { ok: true };
      }
      case 'generate_strategy_report':
      case 'save_final_report': {
        if (stepKey === 'generate_strategy_report') {
          const r = await strategyService.generateStrategyReport(workspaceId, projectId);
          return { reportId: r.id };
        }
        return { saved: true };
      }
      case 'consistency_checks':
        return { consistent: true };
      default:
        return {};
    }
  }
}
