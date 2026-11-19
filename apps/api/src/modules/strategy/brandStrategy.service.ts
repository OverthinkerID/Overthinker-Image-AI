import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { StrategyAiAdapter } from './strategyAi.adapter';

const ai = new StrategyAiAdapter();

export const NAMING_CATEGORIES = [
  'Modern',
  'Premium',
  'Luxury',
  'Minimalist',
  'Corporate',
  'Creative',
  'Futuristic',
  'Traditional',
  'International',
  'Local Identity',
] as const;

export class BrandStrategyService {
  // E. Brand Positioning Intelligence (12 elements + Phase 2 Brand DNA integration)
  async generatePositioning(workspaceId: string, projectId: string, opts?: { provider?: string; allowCloudUpload?: boolean }) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        brandDnas: { include: { personality: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }], take: 1 },
        competitors: { where: { deletedAt: null } },
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null;
    const maxVer = await prisma.brandPositioning.aggregate({ where: { workspaceId, projectId }, _max: { version: true } });
    const nextVer = (maxVer._max.version || 0) + 1;

    const aiRes = await ai.generateStructured({
      workspaceId,
      provider: opts?.provider,
      allowCloudUpload: opts?.allowCloudUpload,
      systemPrompt: 'You are a senior Brand Strategist generating a 12-part Brand Positioning blueprint.',
      prompt: `Generate positioning for "${project.name}" in "${project.industry || 'General'}".`,
      fallback: () => ({
        positioningStmt: `For discerning customers in ${project.industry || 'modern markets'}, ${project.name} delivers disciplined, high-trust brand experiences that stand apart from ${project.competitors.length} tracked competitor(s).`,
        uvp: `${project.name} unifies strategic clarity with unmistakable visual execution.`,
        usp: 'Consistent, research-grounded brand identity across every customer touchpoint.',
        differentiation: 'Intentional minimalism paired with verifiable brand consistency.',
        brandPromise: 'Clarity, precision, and enduring visual authority in every deliverable.',
        brandValues: ['Clarity', 'Precision', 'Authenticity', 'Endurance'],
        brandPersonality: dna?.personality?.visualStyle || 'Composed, Modern, Authoritative',
        brandArchetype: 'The Creator / The Sage',
        brandVoice: dna?.personality?.brandTone || 'Confident, clear, and insightful',
        keyMessaging: [`${project.name}: Built for enduring clarity.`, 'Precision-crafted identity for modern audiences.'],
        reasonsToBelieve: ['Grounded in approved Brand DNA', 'Verified visual consistency across touchpoints'],
        strategicDirection: `Anchor all Phase 4–9 visual outputs on ${project.name}'s approved positioning and value proposition.`,
      }),
    });

    const d = aiRes.data;
    return prisma.brandPositioning.create({
      data: {
        workspaceId,
        projectId,
        brandDnaId: dna?.id || null,
        version: nextVer,
        positioningStmt: d.positioningStmt,
        uvp: d.uvp,
        usp: d.usp,
        differentiation: d.differentiation,
        brandPromise: d.brandPromise,
        brandValuesJson: JSON.stringify(d.brandValues),
        brandPersonality: d.brandPersonality,
        brandArchetype: d.brandArchetype,
        brandVoice: d.brandVoice,
        keyMessagingJson: JSON.stringify(d.keyMessaging),
        reasonsToBelieveJson: JSON.stringify(d.reasonsToBelieve),
        strategicDirection: d.strategicDirection,
        provider: aiRes.providerUsed,
        model: aiRes.modelUsed,
      },
    });
  }

  async listPositionings(workspaceId: string, projectId: string) {
    return prisma.brandPositioning.findMany({ where: { workspaceId, projectId }, orderBy: { version: 'desc' } });
  }

  async updatePositioning(workspaceId: string, projectId: string, positioningId: string, input: Record<string, unknown>) {
    const existing = await prisma.brandPositioning.findFirst({ where: { id: positioningId, workspaceId, projectId } });
    if (!existing) throw new AppError(404, 'POSITIONING_NOT_FOUND', 'Positioning not found.');
    return prisma.brandPositioning.update({
      where: { id: positioningId },
      data: {
        ...(input.positioningStmt !== undefined ? { positioningStmt: String(input.positioningStmt) } : {}),
        ...(input.uvp !== undefined ? { uvp: String(input.uvp) } : {}),
        ...(input.usp !== undefined ? { usp: String(input.usp) } : {}),
        ...(input.strategicDirection !== undefined ? { strategicDirection: String(input.strategicDirection) } : {}),
      },
    });
  }

  async approvePositioning(workspaceId: string, projectId: string, positioningId: string) {
    const existing = await prisma.brandPositioning.findFirst({ where: { id: positioningId, workspaceId, projectId } });
    if (!existing) throw new AppError(404, 'POSITIONING_NOT_FOUND', 'Positioning not found.');
    const approved = await prisma.brandPositioning.update({
      where: { id: positioningId },
      data: { isApproved: true, approvedAt: new Date() },
    });
    // Sync approved positioning into latest Brand DNA if present (without duplicating Brand DNA)
    if (approved.brandDnaId) {
      await prisma.brandDna.update({
        where: { id: approved.brandDnaId },
        data: { visualDirection: approved.strategicDirection },
      }).catch(() => undefined);
    }
    return approved;
  }

  // F. AI Naming & Tagline Studio (min 10 names + min 10 taglines)
  async generateNames(workspaceId: string, projectId: string, input?: { seedWord?: string; industry?: string }) {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const root = (input?.seedWord || project.name.split(/\s+/)[0] || 'Vero').replace(/[^a-zA-Z]/g, '') || 'Vero';
    const domainStatus = ai.domainCheck.getStatus().status;

    const suffixes: Record<(typeof NAMING_CATEGORIES)[number], string> = {
      Modern: `${root}ly`,
      Premium: `${root}a`,
      Luxury: `Maison ${root}`,
      Minimalist: `${root.slice(0, 4)}o`,
      Corporate: `${root} Group`,
      Creative: `${root}Spark`,
      Futuristic: `${root}X`,
      Traditional: `${root} & Co`,
      International: `${root}Global`,
      'Local Identity': `${root}Nusa`,
    };

    const created = [];
    for (const cat of NAMING_CATEGORIES) {
      const candidateName = suffixes[cat];
      created.push(
        await prisma.brandNamingCandidate.create({
          data: {
            workspaceId,
            projectId,
            category: cat,
            brandName: candidateName,
            meaning: `${cat} expression derived from "${root}" reflecting clarity and purpose.`,
            namingConcept: `${cat} lexical framing tailored for ${input?.industry || project.industry || 'modern audiences'}.`,
            pronunciation: candidateName.toLowerCase(),
            industrySuitability: 'High alignment with category positioning',
            audienceSuitability: 'Accessible and memorable across digital channels',
            personalityAlignment: `Reinforces ${cat.toLowerCase()} brand tone`,
            strengthsJson: JSON.stringify(['Short cadence', 'Clear phonetics']),
            weaknessesJson: JSON.stringify(['Requires formal trademark clearance before registration']),
            similarityNote: 'Indicative internal check only; no external trademark database connected.',
            domainCheckStatus: domainStatus,
          },
        })
      );
    }
    return created;
  }

  async generateTaglines(workspaceId: string, projectId: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const name = project.name;

    const taglines = [
      { tagline: `${name}. Clarity in Every Detail.`, tone: 'Authoritative', meaning: 'Emphasizes precision and craftsmanship.' },
      { tagline: `Designed for What Comes Next.`, tone: 'Futuristic', meaning: 'Forward-looking innovation.' },
      { tagline: `Simple. Intentional. Enduring.`, tone: 'Minimalist', meaning: 'Timeless minimalist promise.' },
      { tagline: `Crafted for Modern Leaders.`, tone: 'Premium', meaning: 'Executive appeal and quality.' },
      { tagline: `Where Strategy Meets Form.`, tone: 'Editorial', meaning: 'Bridges thinking and aesthetics.' },
      { tagline: `Built Around Your World.`, tone: 'Approachable', meaning: 'Customer-centric warmth.' },
      { tagline: `Precision You Can Trust.`, tone: 'Corporate', meaning: 'Reliability and institutional trust.' },
      { tagline: `Boldly Distinct, Effortlessly Clear.`, tone: 'Contemporary', meaning: 'Stands out without clutter.' },
      { tagline: `Elevate the Everyday.`, tone: 'Luxury', meaning: 'Refined daily experience.' },
      { tagline: `Rooted in Purpose, Built to Scale.`, tone: 'Strategic', meaning: 'Combines authenticity with growth.' },
    ];

    const created = [];
    for (const t of taglines) {
      created.push(
        await prisma.brandTaglineCandidate.create({
          data: {
            workspaceId,
            projectId,
            tagline: t.tagline,
            meaning: t.meaning,
            tone: t.tone,
            audienceSuitability: 'Aligned with primary target segments',
            positioningAlignment: `Supports ${name} strategic positioning`,
          },
        })
      );
    }
    return created;
  }

  // G. 22-Section Brand Strategy Report Generator + PDF / DOCX / JSON Export
  async generateStrategyReport(workspaceId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        marketResearchProjects: { include: { sources: true, industryAnalyses: { take: 1, orderBy: { createdAt: 'desc' } }, trends: true }, take: 1, orderBy: { createdAt: 'desc' } },
        competitors: { where: { deletedAt: null } },
        audienceSegments: true,
        customerPersonas: { where: { deletedAt: null } },
        customerJourneys: { take: 1, orderBy: { createdAt: 'desc' } },
        brandPositionings: { orderBy: [{ isApproved: 'desc' }, { version: 'desc' }], take: 1 },
        namingCandidates: { take: 10 },
        taglineCandidates: { take: 10 },
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

    const research = project.marketResearchProjects[0];
    const analysis = research?.industryAnalyses[0];
    const pos = project.brandPositionings[0];
    const maxVer = await prisma.brandStrategyReport.aggregate({ where: { workspaceId, projectId }, _max: { version: true } });
    const nextVer = (maxVer._max.version || 0) + 1;

    const sections = [
      { key: 'cover', title: '1. Cover', content: `${project.name} — Brand Strategy & Market Intelligence Report (v${nextVer})` },
      { key: 'executive_summary', title: '2. Executive Summary', content: pos?.positioningStmt || `Strategic foundation for ${project.name}.` },
      { key: 'brand_overview', title: '3. Brand Overview', content: project.description || `${project.name} (${project.industry || 'General'}).` },
      { key: 'industry_analysis', title: '4. Industry Analysis', content: analysis?.overview || 'Run Market Research Engine to populate verified industry analysis.' },
      { key: 'market_research', title: '5. Market Research', content: research ? `Research Goal: ${research.researchGoal || 'Strategic positioning'}` : 'No market research project linked yet.' },
      { key: 'industry_trends', title: '6. Industry Trends', content: research?.trends.map((t) => `• ${t.title}: ${t.description}`).join('\n') || 'Pending trend analysis.' },
      { key: 'swot_analysis', title: '7. SWOT Analysis', content: analysis?.swotJson || '{}' },
      { key: 'pestle_analysis', title: '8. PESTLE Analysis', content: analysis?.pestleJson || '{}' },
      { key: 'competitor_analysis', title: '9. Competitor Analysis', content: project.competitors.map((c) => `• ${c.name} (${c.competitorType}): ${c.positioning || 'Unspecified'}`).join('\n') || 'No competitors added.' },
      { key: 'audience_segmentation', title: '10. Audience Segmentation', content: project.audienceSegments.map((s) => s.name).join(', ') || 'No audience segments defined.' },
      { key: 'customer_personas', title: '11. Customer Personas', content: project.customerPersonas.map((p) => `• ${p.personaName} (${p.occupation || 'N/A'})`).join('\n') || 'No personas generated.' },
      { key: 'customer_journey', title: '12. Customer Journey', content: project.customerJourneys[0]?.stagesJson || 'Pending customer journey mapping.' },
      { key: 'brand_positioning', title: '13. Brand Positioning', content: pos?.positioningStmt || 'Generate Brand Positioning.' },
      { key: 'uvp_usp', title: '14. UVP dan USP', content: pos ? `UVP: ${pos.uvp}\nUSP: ${pos.usp}` : 'Pending UVP/USP.' },
      { key: 'brand_differentiation', title: '15. Brand Differentiation', content: pos?.differentiation || 'Pending differentiation.' },
      { key: 'brand_personality', title: '16. Brand Personality', content: pos?.brandPersonality || 'Pending personality.' },
      { key: 'brand_voice', title: '17. Brand Voice', content: pos?.brandVoice || 'Pending voice.' },
      { key: 'brand_messaging', title: '18. Brand Messaging', content: pos?.keyMessagingJson || '[]' },
      { key: 'naming_and_tagline', title: '19. Naming and Tagline', content: `Names (${project.namingCandidates.length}) | Taglines (${project.taglineCandidates.length})` },
      { key: 'strategic_recommendations', title: '20. Strategic Recommendations', content: analysis?.recommendationsJson || '[]' },
      { key: 'implementation_roadmap', title: '21. Implementation Roadmap', content: 'Phase 1: Approve Positioning -> Phase 2: Align Brand DNA & Design Engine -> Phase 3: Launch Guidelines & Portal.' },
      { key: 'sources_and_references', title: '22. Sources and References', content: research?.sources.map((s) => `${s.title} (${s.url || 'No URL'}) [${s.findingCategory}]`).join('\n') || 'AI Analysis & User Inputs (no external URLs attached).' },
    ];

    return prisma.brandStrategyReport.create({
      data: {
        workspaceId,
        projectId,
        title: `${project.name} Brand Strategy Report v${nextVer}`,
        version: nextVer,
        sectionsJson: JSON.stringify(sections),
        versions: { create: { version: 1, snapshotJson: JSON.stringify(sections), changeNote: 'Initial 22-section strategy report' } },
      },
      include: { versions: true },
    });
  }

  async exportReport(workspaceId: string, projectId: string, reportId: string, format: 'PDF' | 'DOCX' | 'JSON') {
    const report = await prisma.brandStrategyReport.findFirst({ where: { id: reportId, workspaceId, projectId } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Strategy report not found.');
    const sections = JSON.parse(report.sectionsJson || '[]') as Array<{ title: string; content: string }>;
    const safeName = report.title.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (format === 'JSON') {
      return { buffer: Buffer.from(JSON.stringify({ title: report.title, version: report.version, sections }, null, 2), 'utf8'), mimeType: 'application/json', filename: `${safeName}.json` };
    }

    if (format === 'DOCX') {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const paras = sections.map((s) => `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(s.title)}</w:t></w:r></w:p><w:p><w:r><w:t>${esc(s.content)}</w:t></w:r></w:p>`).join('');
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<Buffer>((resolve, reject) => { stream.on('end', () => resolve(Buffer.concat(chunks))); archive.on('error', reject); });
      archive.pipe(stream);
      archive.append(contentTypes, { name: '[Content_Types].xml' });
      archive.append(rels, { name: '_rels/.rels' });
      archive.append(docXml, { name: 'word/document.xml' });
      await archive.finalize();
      return { buffer: await done, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `${safeName}.docx` };
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4', info: { Title: report.title } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text(report.title);
      doc.moveDown(1);
      for (const s of sections) {
        doc.fontSize(12).text(s.title);
        doc.fontSize(10).text(s.content);
        doc.moveDown(0.6);
      }
      doc.end();
    });
    return { buffer: pdfBuffer, mimeType: 'application/pdf', filename: `${safeName}.pdf` };
  }
}
