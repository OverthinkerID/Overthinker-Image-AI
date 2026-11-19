import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';

async function getBrandContext(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');
  const brandDna = await prisma.brandDna.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    include: { colors: true, typography: true, personality: true }
  });
  const positioning = await prisma.brandPositioning.findFirst({
    where: { projectId },
    orderBy: [{ isApproved: 'desc' }, { version: 'desc' }]
  });
  const tagline = await prisma.brandTaglineCandidate.findFirst({
    where: { projectId },
    orderBy: [{ isApproved: 'desc' }, { isFavorite: 'desc' }]
  });
  return { project, brandDna, positioning, tagline };
}

export async function createMarketingProject(
  workspaceId: string,
  projectId: string,
  userId: string | undefined,
  input: { name: string; goal?: string; mode?: string; timezone?: string; provider?: string; model?: string }
) {
  return prisma.marketingProject.create({
    data: {
      workspaceId,
      projectId,
      userId,
      name: input.name,
      goal: input.goal || 'Brand Awareness & Lead Generation',
      mode: input.mode || 'AUTOMATIC',
      timezone: input.timezone || 'Asia/Jakarta',
      provider: input.provider || 'heuristic',
      model: input.model || null
    }
  });
}

export async function generateMarketingStrategy(
  workspaceId: string,
  projectId: string,
  input: {
    marketingProjectId?: string;
    title?: string;
    mode?: string;
    objective?: string;
    channels?: string[];
    budgetCents?: number;
    provider?: string;
    model?: string;
  }
) {
  const { project, brandDna, positioning, tagline } = await getBrandContext(projectId);
  const brandName = brandDna?.brandName || project.name;
  const industry = brandDna?.industry || project.industry || 'Modern Brand';
  const tone = brandDna?.personality?.brandTone || 'Clear, trustworthy, and modern';
  const audience = brandDna?.personality?.targetAudience || 'Digital-first consumers and professionals';
  const uvp = positioning?.uvp || `${brandName} delivers consistent ${industry} quality.`;
  const channels = input.channels?.length ? input.channels : ['INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'YOUTUBE'];
  const totalBudget = input.budgetCents ?? 100000;

  const channelMix = channels.map((ch, idx) => ({
    platform: ch,
    role: idx === 0 ? 'PRIMARY_REACH' : idx === 1 ? 'SHORT_FORM_DISCOVERY' : 'AUTHORITY_CONVERSION',
    sharePct: Math.round(100 / channels.length),
    toneAdaptation: `${tone} adapted for ${ch}`
  }));

  const strategy = await prisma.marketingStrategy.create({
    data: {
      workspaceId,
      projectId,
      marketingProjectId: input.marketingProjectId || null,
      title: input.title || `${brandName} Growth Strategy`,
      mode: input.mode || 'AUTOMATIC',
      objectivesJson: JSON.stringify([
        input.objective || `Increase ${brandName} brand recall among ${audience}`,
        `Drive qualified traffic using UVP: ${uvp}`,
        tagline ? `Reinforce tagline: "${tagline.tagline}"` : `Establish consistent visual & verbal identity`
      ]),
      funnelPlanJson: JSON.stringify({
        awareness: { goal: 'Reach & Recall', formats: ['Reels', 'TikTok Shorts', 'Carousel'], cta: 'Learn More' },
        consideration: { goal: 'Trust & Education', formats: ['Case Study', 'Behind the Scenes', 'Comparison'], cta: 'Explore Features' },
        conversion: { goal: 'Leads & Sales', formats: ['Landing Page', 'Offer Post', 'Retargeting Ad'], cta: 'Get Started' },
        retention: { goal: 'Community & Advocacy', formats: ['Tips', 'User Spotlight', 'Newsletter'], cta: 'Share Feedback' }
      }),
      channelMixJson: JSON.stringify(channelMix),
      messagingPillarsJson: JSON.stringify([
        { pillar: 'Brand Promise', message: positioning?.brandPromise || uvp },
        { pillar: 'Differentiation', message: positioning?.differentiation || `${brandName} quality & design consistency` },
        { pillar: 'Audience Relevance', message: `Built for ${audience}` }
      ]),
      kpiTargetsJson: JSON.stringify([
        { metric: 'CTR_BENCHMARK_TARGET', note: 'Advisory target only — not guaranteed', targetRange: '1.2% - 2.5%' },
        { metric: 'CONTENT_CADENCE', note: 'Operational schedule target', targetRange: '3-5 posts/week' }
      ]),
      budgetAllocationJson: JSON.stringify({
        totalBudgetCents: totalBudget,
        organicContentPct: 40,
        paidAcquisitionPct: 45,
        retargetingPct: 15
      }),
      provider: input.provider || 'heuristic',
      model: input.model || null
    }
  });

  return strategy;
}

export async function approveMarketingStrategy(workspaceId: string, projectId: string, strategyId: string) {
  const existing = await prisma.marketingStrategy.findFirst({ where: { id: strategyId, workspaceId, projectId } });
  if (!existing) throw new Error('Marketing strategy not found');
  return prisma.marketingStrategy.update({
    where: { id: strategyId },
    data: { isApproved: true, approvedAt: new Date() }
  });
}

export async function generateSocialContentSuite(
  workspaceId: string,
  projectId: string,
  input: {
    campaignId?: string;
    platforms?: string[];
    topic?: string;
    tone?: string;
    provider?: string;
    model?: string;
  }
) {
  const { project, brandDna, positioning, tagline } = await getBrandContext(projectId);
  const brandName = brandDna?.brandName || project.name;
  const tone = input.tone || brandDna?.personality?.brandTone || 'Authentic & confident';
  const platforms = input.platforms?.length
    ? input.platforms
    : ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X_TWITTER'];

  const pillar = await prisma.contentPillar.create({
    data: {
      workspaceId,
      projectId,
      name: input.topic || `${brandName} Brand Value`,
      description: positioning?.uvp || `Core value proposition for ${brandName}`,
      ratioPct: 40,
      anglesJson: JSON.stringify(['Educational', 'Product Showcase', 'Behind the Brand'])
    }
  });

  const createdContents = [];
  for (const platform of platforms) {
    const idea = await prisma.contentIdea.create({
      data: {
        workspaceId,
        projectId,
        pillarId: pillar.id,
        platform,
        format: platform === 'TIKTOK' || platform === 'YOUTUBE' ? 'SHORT' : platform === 'INSTAGRAM' ? 'CAROUSEL' : 'POST',
        title: `${brandName} ${platform} Spotlight`,
        hook: `Why ${brandName} approaches ${project.industry || 'design'} differently`,
        angle: 'Value-first storytelling',
        status: 'SELECTED'
      }
    });

    const caption =
      platform === 'X_TWITTER'
        ? `${brandName}: ${positioning?.usp || 'Crafted with purpose.'} ${tagline ? tagline.tagline : ''} #${brandName.replace(/\s+/g, '')}`.slice(0, 260)
        : `${idea.hook}.\n\n${positioning?.positioningStmt || `${brandName} helps customers experience consistent quality.`}\n\n${tagline ? `"${tagline.tagline}"` : ''}\n\nTone: ${tone}.`;

    const content = await prisma.marketingContent.create({
      data: {
        workspaceId,
        projectId,
        campaignId: input.campaignId || null,
        platform,
        contentType: 'SOCIAL_POST',
        title: idea.title,
        caption,
        hook: idea.hook,
        cta: 'Visit our official page to learn more',
        hashtagsJson: JSON.stringify([`#${brandName.replace(/\s+/g, '')}`, `#${platform.toLowerCase()}`, '#BrandStory']),
        visualPrompt: `Brand visual for ${brandName} on ${platform} using primary brand palette and clean typography`,
        status: 'DRAFT',
        provider: input.provider || 'heuristic',
        model: input.model || null
      }
    });

    await prisma.contentVariant.createMany({
      data: [
        {
          workspaceId,
          contentId: content.id,
          label: 'A',
          headline: `${brandName}: Built for Clarity`,
          body: caption,
          cta: 'Learn More',
          tone
        },
        {
          workspaceId,
          contentId: content.id,
          label: 'B',
          headline: `Discover ${brandName} Today`,
          body: `${idea.hook} — ${positioning?.uvp || 'Designed for everyday impact.'}`,
          cta: 'Explore Now',
          tone: 'Direct & Action-Oriented'
        }
      ]
    });

    createdContents.push(content);
  }

  return { pillar, contents: createdContents };
}

export async function generateCopywritingVariants(
  workspaceId: string,
  projectId: string,
  input: {
    contentType: string;
    platform: string;
    topic: string;
    tone?: string;
    cta?: string;
  }
) {
  const { project, brandDna, positioning } = await getBrandContext(projectId);
  const brandName = brandDna?.brandName || project.name;
  const tone = input.tone || brandDna?.personality?.brandTone || 'Persuasive & clear';

  const content = await prisma.marketingContent.create({
    data: {
      workspaceId,
      projectId,
      platform: input.platform,
      contentType: input.contentType,
      title: `${input.topic} (${input.contentType})`,
      caption: `${brandName} — ${input.topic}. ${positioning?.uvp || ''}`,
      hook: `Stop settling for generic ${project.industry || 'solutions'} — meet ${brandName}.`,
      cta: input.cta || 'Start Now',
      status: 'DRAFT'
    }
  });

  const variants = await Promise.all([
    prisma.contentVariant.create({
      data: {
        workspaceId,
        contentId: content.id,
        label: 'A',
        headline: `${brandName}: ${input.topic}`,
        body: `Designed with ${tone} voice. ${positioning?.brandPromise || 'Consistent brand experience.'}`,
        cta: input.cta || 'Start Now',
        tone
      }
    }),
    prisma.contentVariant.create({
      data: {
        workspaceId,
        contentId: content.id,
        label: 'B',
        headline: `Why ${brandName} Stands Out`,
        body: `${positioning?.differentiation || `${brandName} focuses on real customer value.`} ${input.topic}.`,
        cta: input.cta || 'See How It Works',
        tone: 'Analytical'
      }
    }),
    prisma.contentVariant.create({
      data: {
        workspaceId,
        contentId: content.id,
        label: 'C',
        headline: `Ready for ${input.topic}?`,
        body: `Take the next step with ${brandName}. Clear, reliable, and aligned with your goals.`,
        cta: input.cta || 'Get Started',
        tone: 'Conversational'
      }
    })
  ]);

  return { content, variants };
}

export async function approveMarketingContent(workspaceId: string, projectId: string, contentId: string) {
  const existing = await prisma.marketingContent.findFirst({ where: { id: contentId, workspaceId, projectId } });
  if (!existing) throw new Error('Marketing content not found');
  return prisma.marketingContent.update({
    where: { id: contentId },
    data: { isApproved: true, approvedAt: new Date(), status: 'APPROVED' }
  });
}

export async function createContentCalendar(
  workspaceId: string,
  projectId: string,
  input: { name: string; timezone?: string; viewMode?: string; marketingProjectId?: string }
) {
  return prisma.contentCalendar.create({
    data: {
      workspaceId,
      projectId,
      marketingProjectId: input.marketingProjectId || null,
      name: input.name,
      timezone: input.timezone || 'Asia/Jakarta',
      viewMode: input.viewMode || 'MONTHLY'
    }
  });
}

export async function scheduleCalendarItem(
  workspaceId: string,
  calendarId: string,
  input: { contentId?: string; title: string; platform: string; scheduledAt: string; timezone?: string; notes?: string }
) {
  const cal = await prisma.contentCalendar.findFirst({ where: { id: calendarId, workspaceId } });
  if (!cal) throw new Error('Content calendar not found');
  return prisma.contentScheduleItem.create({
    data: {
      workspaceId,
      calendarId,
      contentId: input.contentId || null,
      title: input.title,
      platform: input.platform,
      scheduledAt: new Date(input.scheduledAt),
      timezone: input.timezone || cal.timezone,
      status: 'SCHEDULED',
      notes: input.notes || null
    }
  });
}

export async function createAdCampaignWithEstimator(
  workspaceId: string,
  projectId: string,
  input: {
    marketingCampaignId?: string;
    platform: string;
    name: string;
    objective: string;
    dailyBudgetCents: number;
    durationDays: number;
    currency?: string;
    targeting?: Record<string, unknown>;
  }
) {
  const { project, brandDna, positioning } = await getBrandContext(projectId);
  const totalBudgetCents = input.dailyBudgetCents * input.durationDays;
  const assumedCpcCents = input.platform === 'LINKEDIN_ADS' ? 250 : input.platform === 'GOOGLE_ADS' ? 120 : 65;
  const estimatedClicksLow = Math.floor((totalBudgetCents * 0.7) / assumedCpcCents);
  const estimatedClicksHigh = Math.floor((totalBudgetCents * 1.15) / assumedCpcCents);

  const budgetEstimate = {
    totalBudgetCents,
    currency: input.currency || 'USD',
    assumptions: {
      assumedCpcCents,
      basis: 'Heuristic industry benchmark range; actual auction costs vary by audience, bid, and creative quality.'
    },
    estimatedClicksRange: { min: estimatedClicksLow, max: estimatedClicksHigh },
    disclaimer: 'Advisory budget estimate only. Does not guarantee clicks, conversions, or ROI.'
  };

  const adCampaign = await prisma.adCampaign.create({
    data: {
      workspaceId,
      projectId,
      marketingCampaignId: input.marketingCampaignId || null,
      platform: input.platform,
      name: input.name,
      objective: input.objective,
      dailyBudgetCents: input.dailyBudgetCents,
      durationDays: input.durationDays,
      currency: input.currency || 'USD',
      targetingJson: JSON.stringify(input.targeting || { ageRange: '22-45', interests: [project.industry || 'Design'] }),
      budgetEstimateJson: JSON.stringify(budgetEstimate),
      status: 'DRAFT'
    }
  });

  const creative = await prisma.adCreative.create({
    data: {
      workspaceId,
      adCampaignId: adCampaign.id,
      format: 'SINGLE_IMAGE',
      headline: `${brandDna?.brandName || project.name} — ${input.objective}`,
      primaryText: positioning?.uvp || `Discover ${brandDna?.brandName || project.name}.`,
      description: `Official ${input.platform} campaign creative.`,
      cta: 'Learn More',
      variantLabel: 'A'
    }
  });

  return { adCampaign, creative, budgetEstimate };
}

export const CAMPAIGN_14_STAGES = [
  '1. Brand & Strategy Sync',
  '2. Campaign Objective & KPIs',
  '3. Audience & Persona Alignment',
  '4. Channel Selection',
  '5. Core Messaging & Hook',
  '6. Content Pillars',
  '7. Social Content Production',
  '8. Copywriting & A/B Variants',
  '9. Visual & Design Asset Prep',
  '10. Ad Campaign & Budget Plan',
  '11. Landing Page Assembly',
  '12. Content Calendar Scheduling',
  '13. Approval & Pre-flight Check',
  '14. Export & Launch Readiness'
];

export async function createMarketingCampaign(
  workspaceId: string,
  projectId: string,
  input: {
    marketingProjectId?: string;
    name: string;
    objective: string;
    mode?: string;
    budgetCents?: number;
    channels?: string[];
  }
) {
  const campaign = await prisma.marketingCampaign.create({
    data: {
      workspaceId,
      projectId,
      marketingProjectId: input.marketingProjectId || null,
      name: input.name,
      objective: input.objective,
      mode: input.mode || 'AUTOMATIC',
      stage: 1,
      status: 'IN_PROGRESS',
      budgetCents: input.budgetCents ?? 150000,
      workflowStateJson: JSON.stringify({ stages: CAMPAIGN_14_STAGES, completedStages: [1] })
    }
  });

  const channels = input.channels?.length ? input.channels : ['INSTAGRAM', 'TIKTOK', 'META_ADS'];
  await prisma.campaignChannel.createMany({
    data: channels.map((platform, i) => ({
      workspaceId,
      campaignId: campaign.id,
      platform,
      role: i === 0 ? 'PRIMARY' : 'SECONDARY',
      budgetShare: Number((100 / channels.length).toFixed(2))
    }))
  });

  return prisma.marketingCampaign.findUnique({
    where: { id: campaign.id },
    include: { channels: true }
  });
}

export async function advanceCampaignStage(
  workspaceId: string,
  projectId: string,
  campaignId: string,
  nextStage?: number
) {
  const campaign = await prisma.marketingCampaign.findFirst({ where: { id: campaignId, workspaceId, projectId } });
  if (!campaign) throw new Error('Campaign not found');
  const targetStage = Math.min(14, Math.max(1, nextStage ?? campaign.stage + 1));
  const state = JSON.parse(campaign.workflowStateJson || '{}') as { completedStages?: number[] };
  const completed = Array.from(new Set([...(state.completedStages || []), targetStage])).sort((a, b) => a - b);

  return prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: {
      stage: targetStage,
      status: targetStage === 13 ? 'WAITING_APPROVAL' : targetStage === 14 ? 'APPROVED' : 'IN_PROGRESS',
      workflowStateJson: JSON.stringify({ stages: CAMPAIGN_14_STAGES, completedStages: completed })
    }
  });
}

export async function exportCampaignZip(workspaceId: string, projectId: string, campaignId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, workspaceId, projectId },
    include: { channels: true, contents: true, adCampaigns: true }
  });
  if (!campaign) throw new Error('Campaign not found');

  const outDir = path.join(env.storageRoot, workspaceId, projectId, 'marketing-exports');
  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, `campaign-${campaign.id}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(
      JSON.stringify(
        {
          campaignId: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          stage: campaign.stage,
          status: campaign.status,
          channels: campaign.channels,
          contentsCount: campaign.contents.length,
          adCampaignsCount: campaign.adCampaigns.length,
          exportedAt: new Date().toISOString()
        },
        null,
        2
      ),
      { name: 'manifest.json' }
    );
    archive.append(JSON.stringify(campaign.contents, null, 2), { name: 'contents.json' });
    archive.append(JSON.stringify(campaign.adCampaigns, null, 2), { name: 'ads.json' });
    archive.finalize();
  });

  await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: { exportPath: zipPath }
  });

  return { zipPath, fileSize: fs.statSync(zipPath).size };
}

export function sanitizeHtmlContent(rawHtml: string): string {
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, 'blocked:');
}

export async function generateLandingPage(
  workspaceId: string,
  projectId: string,
  input: { title?: string; slug?: string; customHtmlSnippet?: string; ctaText?: string }
) {
  const { project, brandDna, positioning, tagline } = await getBrandContext(projectId);
  const brandName = brandDna?.brandName || project.name;
  const primaryColor = brandDna?.colors?.[0]?.hex || '#111827';
  const accentColor = brandDna?.colors?.[1]?.hex || '#2563EB';
  const headingFont = brandDna?.typography?.headingFont || 'Inter, sans-serif';
  const bodyFont = brandDna?.typography?.bodyFont || 'Inter, sans-serif';

  const sections = [
    { key: 'hero', heading: brandName, subheading: tagline?.tagline || positioning?.uvp || 'Built with clarity' },
    { key: 'value', heading: 'Why Choose Us', body: positioning?.differentiation || 'Consistent quality & design' },
    { key: 'offer', heading: 'Get Started', cta: input.ctaText || 'Contact Us' }
  ];

  // Note: Never fabricate fake testimonials. Only include optional verified user-supplied section placeholder.
  const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${brandName}</title></head>
<body>
  <header class="hero">
    <h1>${brandName}</h1>
    <p>${tagline?.tagline || positioning?.uvp || `${brandName} official landing page`}</p>
    <a class="cta" href="#contact">${input.ctaText || 'Get Started'}</a>
  </header>
  <section class="value">
    <h2>Value Proposition</h2>
    <p>${positioning?.positioningStmt || `${brandName} delivers consistent ${project.industry || 'brand'} experiences.`}</p>
  </section>
  ${input.customHtmlSnippet ? `<section class="custom">${input.customHtmlSnippet}</section>` : ''}
  <footer id="contact"><p>&copy; ${new Date().getFullYear()} ${brandName}</p></footer>
</body>
</html>`;

  const sanitizedHtml = sanitizeHtmlContent(rawHtml);
  const cssContent = `body { font-family: ${bodyFont}; margin: 0; color: #111827; }
h1, h2 { font-family: ${headingFont}; }
.hero { background: ${primaryColor}; color: #fff; padding: 64px 24px; text-align: center; }
.cta { display: inline-block; background: ${accentColor}; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
.value { max-width: 800px; margin: 40px auto; padding: 0 24px; }`;

  return prisma.landingPage.create({
    data: {
      workspaceId,
      projectId,
      title: input.title || `${brandName} Landing Page`,
      slug: input.slug || `${project.slug}-landing-${Date.now()}`,
      sectionsJson: JSON.stringify(sections),
      htmlContent: sanitizedHtml,
      cssContent,
      jsContent: '// Clean static landing page bundle',
      isSanitized: true
    }
  });
}
