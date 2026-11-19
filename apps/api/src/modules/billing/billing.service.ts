import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export interface PaymentGatewayAdapter {
  readonly providerName: string;
  isConfigured(): boolean;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export class ConfigurableHmacPaymentAdapter implements PaymentGatewayAdapter {
  public readonly providerName: string;
  private readonly webhookSecret: string;
  private readonly apiKey: string;

  constructor(providerName = process.env.PAYMENT_PROVIDER || 'NONE') {
    this.providerName = providerName;
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    this.apiKey = process.env.PAYMENT_PROVIDER_KEY || '';
  }

  isConfigured(): boolean {
    return this.providerName !== 'NONE' && Boolean(this.webhookSecret && this.apiKey);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!this.webhookSecret || !signatureHeader) return false;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '').trim();
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
}

export class BillingService {
  private readonly gateway = new ConfigurableHmacPaymentAdapter();

  async listPlans() {
    return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPriceCents: 'asc' } });
  }

  async upsertPlan(input: {
    code: string;
    name: string;
    description?: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
    currency?: string;
    workspaceLimit: number;
    projectLimit: number;
    memberLimit: number;
    aiImageQuota: number;
    aiTextQuota: number;
    storageQuotaMb: number;
    exportLimit: number;
    features?: Record<string, unknown>;
  }) {
    return prisma.subscriptionPlan.upsert({
      where: { code: input.code.toUpperCase() },
      update: {
        name: input.name,
        description: input.description || null,
        monthlyPriceCents: input.monthlyPriceCents,
        annualPriceCents: input.annualPriceCents,
        currency: input.currency || 'USD',
        workspaceLimit: input.workspaceLimit,
        projectLimit: input.projectLimit,
        memberLimit: input.memberLimit,
        aiImageQuota: input.aiImageQuota,
        aiTextQuota: input.aiTextQuota,
        storageQuotaMb: input.storageQuotaMb,
        exportLimit: input.exportLimit,
        featuresJson: JSON.stringify(input.features || {}),
      },
      create: {
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description || null,
        monthlyPriceCents: input.monthlyPriceCents,
        annualPriceCents: input.annualPriceCents,
        currency: input.currency || 'USD',
        workspaceLimit: input.workspaceLimit,
        projectLimit: input.projectLimit,
        memberLimit: input.memberLimit,
        aiImageQuota: input.aiImageQuota,
        aiTextQuota: input.aiTextQuota,
        storageQuotaMb: input.storageQuotaMb,
        exportLimit: input.exportLimit,
        featuresJson: JSON.stringify(input.features || {}),
      },
    });
  }

  async getWorkspaceSubscription(workspaceId: string) {
    return prisma.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  async assignOrChangePlan(workspaceId: string, input: { planCode: string; billingCycle?: 'MONTHLY' | 'ANNUAL'; startTrialDays?: number }) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: input.planCode.toUpperCase() } });
    if (!plan || !plan.isActive) throw new AppError(404, 'PLAN_NOT_FOUND', 'Subscription plan not found.');

    const amountCents = input.billingCycle === 'ANNUAL' ? plan.annualPriceCents : plan.monthlyPriceCents;
    if (amountCents > 0 && !input.startTrialDays && !this.gateway.isConfigured()) {
      throw new AppError(402, 'PAYMENT_PROVIDER_UNCONFIGURED', 'Real payment collection is disabled until payment provider credentials are configured.');
    }

    const now = new Date();
    const trialEndsAt = input.startTrialDays ? new Date(now.getTime() + input.startTrialDays * 86400_000) : null;
    const status = trialEndsAt ? 'TRIALING' : amountCents === 0 ? 'ACTIVE' : 'ACTIVE';
    const sub = await prisma.subscription.upsert({
      where: { workspaceId },
      update: { planId: plan.id, billingCycle: input.billingCycle || 'MONTHLY', status, trialEndsAt, cancelAtPeriodEnd: false },
      create: {
        workspaceId,
        planId: plan.id,
        billingCycle: input.billingCycle || 'MONTHLY',
        status,
        trialEndsAt,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
      },
      include: { plan: true },
    });

    await prisma.invoice.create({
      data: {
        workspaceId,
        subscriptionId: sub.id,
        invoiceNumber: `INV-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        amountCents: trialEndsAt ? 0 : amountCents,
        currency: plan.currency,
        status: amountCents === 0 || trialEndsAt ? 'PAID' : 'OPEN',
        paidAt: amountCents === 0 || trialEndsAt ? now : null,
      },
    });
    return sub;
  }

  async cancelSubscription(workspaceId: string) {
    const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No subscription found for workspace.');
    return prisma.subscription.update({ where: { workspaceId }, data: { cancelAtPeriodEnd: true, status: 'CANCELLED' }, include: { plan: true } });
  }

  async checkEntitlement(workspaceId: string, resource: 'PROJECTS' | 'MEMBERS' | 'AI_IMAGE_GEN' | 'AI_TEXT_GEN' | 'EXPORTS') {
    const sub = await prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
    if (!sub) return { allowed: true, reason: 'No subscription plan enforced (Local/Unmetered).' };
    if (sub.status === 'EXPIRED' || sub.status === 'PAST_DUE') {
      return { allowed: false, reason: `Subscription status is ${sub.status}.` };
    }
    if (resource === 'PROJECTS') {
      const count = await prisma.project.count({ where: { workspaceId } });
      return { allowed: count < sub.plan.projectLimit, limit: sub.plan.projectLimit, current: count };
    }
    if (resource === 'MEMBERS') {
      const count = await prisma.workspaceMember.count({ where: { workspaceId } });
      return { allowed: count < sub.plan.memberLimit, limit: sub.plan.memberLimit, current: count };
    }
    const agg = await prisma.usageRecord.aggregate({ where: { workspaceId, metric: resource }, _sum: { quantity: true } });
    const used = agg._sum.quantity || 0;
    const limit = resource === 'AI_IMAGE_GEN' ? sub.plan.aiImageQuota : resource === 'AI_TEXT_GEN' ? sub.plan.aiTextQuota : sub.plan.exportLimit;
    return { allowed: used < limit, limit, current: used };
  }

  async processWebhook(rawBody: string, signatureHeader: string, payload: { id?: string; type?: string; workspaceId?: string; invoiceId?: string; amountCents?: number }) {
    if (!this.gateway.isConfigured()) {
      throw new AppError(503, 'PAYMENT_WEBHOOK_UNCONFIGURED', 'Payment webhook secret is not configured.');
    }
    const signatureValid = this.gateway.verifyWebhookSignature(rawBody, signatureHeader);
    if (!signatureValid) {
      throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
    }
    const externalEventId = String(payload.id || '');
    if (!externalEventId) throw new AppError(400, 'MISSING_EVENT_ID', 'Webhook event id is required.');

    // Idempotency check
    const existing = await prisma.billingEvent.findUnique({ where: { externalEventId } });
    if (existing) return { duplicate: true, event: existing };

    const event = await prisma.billingEvent.create({
      data: {
        workspaceId: payload.workspaceId || null,
        provider: this.gateway.providerName,
        externalEventId,
        eventType: String(payload.type || 'payment.succeeded'),
        payloadJson: rawBody,
        signatureValid: true,
        processedAt: new Date(),
      },
    });

    if (payload.type === 'payment.succeeded' && payload.workspaceId) {
      await prisma.subscription.updateMany({ where: { workspaceId: payload.workspaceId }, data: { status: 'ACTIVE' } });
      if (payload.invoiceId) {
        await prisma.invoice.updateMany({ where: { id: payload.invoiceId, workspaceId: payload.workspaceId }, data: { status: 'PAID', paidAt: new Date() } });
      }
      await prisma.paymentTransaction.create({
        data: {
          workspaceId: payload.workspaceId,
          invoiceId: payload.invoiceId || null,
          provider: this.gateway.providerName,
          externalTxId: externalEventId,
          amountCents: payload.amountCents || 0,
          status: 'SUCCEEDED',
        },
      });
    }

    return { duplicate: false, event };
  }
}
