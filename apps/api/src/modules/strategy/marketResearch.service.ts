import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { StrategyAiAdapter } from './strategyAi.adapter';

const ai = new StrategyAiAdapter();

export class MarketResearchService {
  // B. Market Research Engine
  async createResearchProject(
    workspaceId: string,
    projectId: string,
    userId: string,
    input: {
      brandName: string;
      industry: string;
      country?: string;
      targetRegion?: string;
      productType?: string;
      targetMarket?: string;
      priceRange?: string;
      businessDesc?: string;
      researchGoal?: string;
      provider?: string;
    }
  ) {
    return prisma.marketResearchProject.create({
      data: {
        workspaceId,
        projectId,
        userId,
        brandName: input.brandName,
        industry: input.industry,
        country: input.country || null,
        targetRegion: input.targetRegion || null,
        productType: input.productType || null,
        targetMarket: input.targetMarket || null,
        priceRange: input.priceRange || null,
        businessDesc: input.businessDesc || null,
        researchGoal: input.researchGoal || null,
        provider: input.provider || 'heuristic',
        status: 'DRAFT',
      },
    });
  }

  async listResearchProjects(workspaceId: string, projectId: string) {
    return prisma.marketResearchProject.findMany({
      where: { workspaceId, projectId, deletedAt: null },
      include: { sources: true, industryAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 }, trends: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getResearchProject(workspaceId: string, projectId: string, researchId: string) {
    const rp = await prisma.marketResearchProject.findFirst({
      where: { id: researchId, workspaceId, projectId, deletedAt: null },
      include: { sources: { orderBy: { retrievedAt: 'desc' } }, industryAnalyses: { orderBy: { createdAt: 'desc' } }, trends: true },
    });
    if (!rp) throw new AppError(404, 'RESEARCH_NOT_FOUND', 'Market research project not found.');
    return rp;
  }

  async addSource(
    workspaceId: string,
    projectId: string,
    researchId: string,
    input: { title: string; url?: string; publisher?: string; publishedAt?: string; findingCategory?: string; confidence?: number; excerpt?: string }
  ) {
    await this.getResearchProject(workspaceId, projectId, researchId);
    return prisma.marketResearchSource.create({
      data: {
        workspaceId,
        researchProjectId: researchId,
        title: input.title,
        url: input.url || null,
        publisher: input.publisher || null,
        publishedAt: input.publishedAt || null,
        findingCategory: input.findingCategory || 'VERIFIED_DATA',
        confidence: input.confidence ?? 0.9,
        excerpt: input.excerpt || null,
      },
    });
  }

  async analyzeResearch(workspaceId: string, projectId: string, researchId: string, opts?: { provider?: string; allowCloudUpload?: boolean }) {
    const rp = await this.getResearchProject(workspaceId, projectId, researchId);
    await prisma.marketResearchProject.update({ where: { id: rp.id }, data: { status: 'RUNNING' } });

    const externalStatus = ai.webResearch.getStatus();
    const regionLabel = [rp.targetRegion, rp.country].filter(Boolean).join(', ') || 'Target Region Unspecified';

    const aiRes = await ai.generateStructured({
      workspaceId,
      provider: opts?.provider || rp.provider,
      allowCloudUpload: opts?.allowCloudUpload,
      systemPrompt: 'You are a senior Market Research Analyst. Never fabricate market size, CAGR, or revenue statistics. State explicitly when verified statistics are unavailable.',
      prompt: `Analyze industry "${rp.industry}" for "${rp.brandName}" in ${regionLabel}. Product: ${rp.productType || 'Unspecified'}. Goal: ${rp.researchGoal || 'Brand launch'}.`,
      fallback: () => ({
        overview: `Qualitative market analysis for ${rp.brandName} in ${rp.industry} (${regionLabel}). Quantitative market size, CAGR, and market share figures are not yet available because no verified external statistical source has been attached.`,
        characteristics: [`Industry: ${rp.industry}`, `Price positioning: ${rp.priceRange || 'Unspecified'}`, `External web research status: ${externalStatus.status}`],
        consumerBehavior: `Target audience (${rp.targetMarket || 'General market'}) evaluates trust, clarity of value proposition, and consistent brand presentation.`,
        opportunities: ['Differentiate on clear positioning and cohesive visual identity', 'Capture underserved niche segments in target region'],
        challenges: ['Limited verified quantitative market data until primary sources are attached', 'Competitive noise in digital channels'],
        threats: ['Established incumbents with higher brand recall', 'Price sensitivity in overlapping segments'],
        swot: {
          strengths: ['Focused brand positioning', 'Agile digital-first execution'],
          weaknesses: ['New market entrant awareness', 'Quantitative market benchmarks pending verification'],
          opportunities: ['Clear visual differentiation', 'Targeted audience messaging'],
          threats: ['Incumbent competition', 'Shifting consumer preferences'],
        },
        pestle: {
          political: 'Monitor local commercial and advertising regulations.',
          economic: `Align pricing (${rp.priceRange || 'TBD'}) with regional purchasing power.`,
          social: 'Growing demand for authentic, transparent brand storytelling.',
          technological: 'Digital discovery and AI-assisted content velocity.',
          legal: 'Formal trademark clearance required independently of AI analysis.',
          environmental: 'Increasing preference for sustainable packaging and operations.',
        },
        marketGaps: ['Underserved clarity between premium aesthetics and accessible messaging'],
        recommendations: ['Attach verified industry reports to upgrade Hypothesis findings to Verified Data', 'Validate positioning with 3–5 target customer interviews'],
        trends: [
          { title: 'Visual-First Brand Trust', description: 'Consistent multi-channel design systems increase perceived credibility.', category: 'HYPOTHESIS', confidence: 0.72 },
          { title: 'Direct Digital Engagement', description: 'Consumers expect transparent product information and responsive brand voice.', category: 'AI_ANALYSIS', confidence: 0.78 },
        ],
      }),
    });

    const d = aiRes.data;
    const analysis = await prisma.industryAnalysis.create({
      data: {
        workspaceId,
        researchProjectId: rp.id,
        overview: d.overview,
        characteristicsJson: JSON.stringify(d.characteristics),
        consumerBehavior: d.consumerBehavior,
        opportunitiesJson: JSON.stringify(d.opportunities),
        challengesJson: JSON.stringify(d.challenges),
        threatsJson: JSON.stringify(d.threats),
        swotJson: JSON.stringify(d.swot),
        pestleJson: JSON.stringify(d.pestle),
        marketGapsJson: JSON.stringify(d.marketGaps),
        recommendationsJson: JSON.stringify(d.recommendations),
        provenanceJson: JSON.stringify({
          externalWebResearch: externalStatus,
          note: 'Qualitative AI Analysis & Hypothesis. No market size, CAGR, or revenue statistics fabricated.',
          sourceCount: rp.sources.length,
        }),
        provider: aiRes.providerUsed,
        model: aiRes.modelUsed,
      },
    });

    for (const t of d.trends) {
      await prisma.marketTrend.create({
        data: {
          workspaceId,
          researchProjectId: rp.id,
          title: t.title,
          description: t.description,
          findingCategory: t.category,
          confidence: t.confidence,
        },
      });
    }

    await prisma.marketResearchProject.update({ where: { id: rp.id }, data: { status: 'COMPLETED', provider: aiRes.providerUsed, model: aiRes.modelUsed } });
    return { analysis, externalStatus };
  }

  // C. Competitor Intelligence
  async createCompetitor(workspaceId: string, projectId: string, input: Record<string, unknown>) {
    return prisma.competitor.create({
      data: {
        workspaceId,
        projectId,
        name: String(input.name || 'Unnamed Competitor'),
        competitorType: String(input.competitorType || 'DIRECT'),
        website: input.website ? String(input.website) : null,
        positioning: input.positioning ? String(input.positioning) : null,
        valueProposition: input.valueProposition ? String(input.valueProposition) : null,
        priceTier: input.priceTier ? String(input.priceTier) : null,
        productsJson: JSON.stringify(input.products || []),
        strengthsJson: JSON.stringify(input.strengths || []),
        weaknessesJson: JSON.stringify(input.weaknesses || []),
        dataProvenance: String(input.dataProvenance || 'USER_INPUT'),
      },
    });
  }

  async listCompetitors(workspaceId: string, projectId: string) {
    return prisma.competitor.findMany({
      where: { workspaceId, projectId, deletedAt: null },
      include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompetitor(workspaceId: string, projectId: string, competitorId: string, input: Record<string, unknown>) {
    const existing = await prisma.competitor.findFirst({ where: { id: competitorId, workspaceId, projectId, deletedAt: null } });
    if (!existing) throw new AppError(404, 'COMPETITOR_NOT_FOUND', 'Competitor not found.');
    return prisma.competitor.update({
      where: { id: competitorId },
      data: {
        ...(input.name !== undefined ? { name: String(input.name) } : {}),
        ...(input.competitorType !== undefined ? { competitorType: String(input.competitorType) } : {}),
        ...(input.website !== undefined ? { website: input.website ? String(input.website) : null } : {}),
        ...(input.positioning !== undefined ? { positioning: input.positioning ? String(input.positioning) : null } : {}),
        ...(input.valueProposition !== undefined ? { valueProposition: input.valueProposition ? String(input.valueProposition) : null } : {}),
        ...(input.priceTier !== undefined ? { priceTier: input.priceTier ? String(input.priceTier) : null } : {}),
      },
    });
  }

  async deleteCompetitor(workspaceId: string, projectId: string, competitorId: string) {
    const res = await prisma.competitor.updateMany({ where: { id: competitorId, workspaceId, projectId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (res.count === 0) throw new AppError(404, 'COMPETITOR_NOT_FOUND', 'Competitor not found.');
    return { deleted: true, id: competitorId };
  }

  async analyzeCompetitor(workspaceId: string, projectId: string, competitorId: string) {
    const comp = await prisma.competitor.findFirst({ where: { id: competitorId, workspaceId, projectId, deletedAt: null } });
    if (!comp) throw new AppError(404, 'COMPETITOR_NOT_FOUND', 'Competitor not found.');
    return prisma.competitorAnalysis.create({
      data: {
        workspaceId,
        competitorId: comp.id,
        visualNotes: comp.website ? `Website reference recorded (${comp.website}). Visual audit pending live capture.` : 'No website URL provided.',
        positioningNotes: `AI Estimate based on provided profile: ${comp.positioning || 'Positioning not yet specified'}.`,
        differentiationGap: `Opportunity to differentiate against ${comp.name} on clarity of value proposition (${comp.valueProposition || 'unspecified'}).`,
        dataProvenance: 'AI_ESTIMATE',
      },
    });
  }

  async compareCompetitors(workspaceId: string, projectId: string) {
    const comps = await this.listCompetitors(workspaceId, projectId);
    const matrix = comps.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.competitorType,
      positioning: c.positioning || 'Unspecified',
      priceTier: c.priceTier || 'Unavailable',
      provenance: c.dataProvenance,
    }));
    const positioningMap = comps.map((c, idx) => ({
      id: c.id,
      name: c.name,
      priceAxis: c.priceTier?.toLowerCase().includes('premium') ? 80 : c.priceTier?.toLowerCase().includes('budget') ? 25 : 50,
      differentiationAxis: 40 + ((idx * 17) % 45),
      isEstimate: true,
    }));
    return prisma.competitorComparison.create({
      data: {
        workspaceId,
        projectId,
        competitorIdsJson: JSON.stringify(comps.map((c) => c.id)),
        matrixJson: JSON.stringify(matrix),
        positioningMapJson: JSON.stringify(positioningMap),
        marketGapsJson: JSON.stringify(['Clear premium-accessible positioning gap', 'Consistent multi-channel visual identity']),
      },
    });
  }

  // D. Audience Intelligence
  async createSegment(workspaceId: string, projectId: string, input: Record<string, unknown>) {
    return prisma.audienceSegment.create({
      data: {
        workspaceId,
        projectId,
        name: String(input.name || 'Primary Segment'),
        demographicJson: JSON.stringify(input.demographic || {}),
        geographicJson: JSON.stringify(input.geographic || {}),
        psychographicJson: JSON.stringify(input.psychographic || {}),
        behavioralJson: JSON.stringify(input.behavioral || {}),
        needsJson: JSON.stringify(input.needs || []),
        painPointsJson: JSON.stringify(input.painPoints || []),
        triggersJson: JSON.stringify(input.triggers || []),
        dataSourceType: String(input.dataSourceType || 'USER_INPUT'),
      },
    });
  }

  async listSegments(workspaceId: string, projectId: string) {
    return prisma.audienceSegment.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } });
  }

  async generatePersonas(workspaceId: string, projectId: string, input?: { targetMarket?: string; industry?: string }) {
    const industry = input?.industry || 'Modern Digital & Consumer Brands';
    const personasData = [
      {
        personaName: 'Quality-Focused Decision Maker (AI Hypothesis)',
        ageRange: '28–42',
        location: 'Urban & Metro Hubs',
        occupation: `Manager / Founder in ${industry}`,
        incomeRange: 'Not specified (user input recommended)',
        lifestyle: 'Digital-first, efficiency-oriented, values trustworthy aesthetics',
        interests: ['Design quality', 'Productivity', 'Trusted brands'],
        goals: ['Solve core workflow problem quickly', 'Partner with reliable brands'],
        painPoints: ['Generic lookalike competitors', 'Unclear product differentiation'],
        needs: ['Clear value proposition', 'Consistent visual credibility'],
        motivations: ['Time savings', 'Perceived quality'],
        barriers: ['Lack of social proof', 'Confusing onboarding'],
        channels: ['LinkedIn', 'Instagram', 'Search'],
        expectations: 'Consistent, transparent brand experience from first impression to delivery.',
      },
      {
        personaName: 'Value-Conscious Explorer (AI Hypothesis)',
        ageRange: '22–34',
        location: 'Regional & Online-First',
        occupation: 'Creative / Specialist',
        incomeRange: 'Not specified (user input recommended)',
        lifestyle: 'Mobile-native, compares alternatives before purchasing',
        interests: ['Trends', 'Community reviews', 'Visual storytelling'],
        goals: ['Find high-value solutions', 'Discover distinctive brands'],
        painPoints: ['Hidden pricing', 'Inconsistent messaging'],
        needs: ['Transparent comparison', 'Authentic brand voice'],
        motivations: ['Peer recommendations', 'Aesthetic appeal'],
        barriers: ['High switching friction'],
        channels: ['YouTube', 'TikTok', 'Instagram'],
        expectations: 'Approachable tone and immediately understandable benefits.',
      },
    ];

    const created = [];
    for (const p of personasData) {
      created.push(
        await prisma.customerPersona.create({
          data: {
            workspaceId,
            projectId,
            personaName: p.personaName,
            ageRange: p.ageRange,
            location: p.location,
            occupation: p.occupation,
            incomeRange: p.incomeRange,
            lifestyle: p.lifestyle,
            interestsJson: JSON.stringify(p.interests),
            goalsJson: JSON.stringify(p.goals),
            painPointsJson: JSON.stringify(p.painPoints),
            needsJson: JSON.stringify(p.needs),
            motivationsJson: JSON.stringify(p.motivations),
            barriersJson: JSON.stringify(p.barriers),
            channelsJson: JSON.stringify(p.channels),
            expectations: p.expectations,
            dataSourceType: 'AI_HYPOTHESIS',
          },
        })
      );
    }

    await prisma.customerJourney.create({
      data: {
        workspaceId,
        projectId,
        title: 'Standard 5-Stage Customer Journey (AI Hypothesis)',
        stagesJson: JSON.stringify([
          { stage: 'Awareness', touchpoints: ['Search', 'Social Media'], emotion: 'Curious', goal: 'Recognize brand distinctiveness' },
          { stage: 'Consideration', touchpoints: ['Website', 'Portfolio / Reviews'], emotion: 'Evaluating', goal: 'Compare UVP vs competitors' },
          { stage: 'Decision', touchpoints: ['Pricing / Proposal', 'Client Portal'], emotion: 'Confident', goal: 'Verify trust and clarity' },
          { stage: 'Retention', touchpoints: ['Deliverables', 'Brand Guidelines'], emotion: 'Satisfied', goal: 'Consistent quality delivery' },
          { stage: 'Advocacy', touchpoints: ['Referrals', 'Case Studies'], emotion: 'Loyal', goal: 'Recommend brand to peers' },
        ]),
        dataSourceType: 'AI_HYPOTHESIS',
      },
    });

    return created;
  }

  async listPersonas(workspaceId: string, projectId: string) {
    return prisma.customerPersona.findMany({ where: { workspaceId, projectId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  async updatePersona(workspaceId: string, projectId: string, personaId: string, input: Record<string, unknown>) {
    const existing = await prisma.customerPersona.findFirst({ where: { id: personaId, workspaceId, projectId, deletedAt: null } });
    if (!existing) throw new AppError(404, 'PERSONA_NOT_FOUND', 'Persona not found.');
    return prisma.customerPersona.update({
      where: { id: personaId },
      data: {
        ...(input.personaName !== undefined ? { personaName: String(input.personaName) } : {}),
        ...(input.incomeRange !== undefined ? { incomeRange: input.incomeRange ? String(input.incomeRange) : null } : {}),
        ...(input.expectations !== undefined ? { expectations: input.expectations ? String(input.expectations) : null } : {}),
        dataSourceType: 'USER_INPUT',
      },
    });
  }
}
