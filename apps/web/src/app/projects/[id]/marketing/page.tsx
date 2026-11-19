'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  FileCode2,
  FolderKanban,
  Globe,
  Megaphone,
  PenTool,
  Plug,
  Send,
  Share2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TabKey =
  | 'overview'
  | 'strategist'
  | 'social'
  | 'copywriting'
  | 'calendar'
  | 'ads'
  | 'campaigns'
  | 'landing'
  | 'publishing'
  | 'integrations'
  | 'analytics'
  | 'recommendations';

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'overview', label: 'Overview', icon: FolderKanban },
  { key: 'strategist', label: 'AI Strategist', icon: Sparkles },
  { key: 'social', label: 'Social Studio', icon: Share2 },
  { key: 'copywriting', label: 'Copywriting', icon: PenTool },
  { key: 'calendar', label: 'Content Calendar', icon: Calendar },
  { key: 'ads', label: 'Ad Studio', icon: Megaphone },
  { key: 'campaigns', label: '14-Stage Campaigns', icon: FolderKanban },
  { key: 'landing', label: 'Landing Pages', icon: FileCode2 },
  { key: 'publishing', label: 'Publishing Engine', icon: Send },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'analytics', label: 'Analytics & CSV', icon: BarChart3 },
  { key: 'recommendations', label: 'AI Growth Analyst', icon: Globe }
];

export default function MarketingStudioPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id || '';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [tab, setTab] = useState<TabKey>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/marketing/overview`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) loadOverview();
  }, [projectId]);

  async function postAction(path: string, body: Record<string, unknown>, label: string) {
    setStatusMsg(`Running ${label}...`);
    const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/marketing${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setStatusMsg(`${label} completed.`);
      await loadOverview();
    } else {
      const err = await res.json().catch(() => ({}));
      setStatusMsg(`Error: ${err.error || res.statusText}`);
    }
  }

  const kpis = data?.kpis || {};

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" /> Project
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">AI Marketing &amp; Brand Growth Studio</h1>
            <p className="text-sm text-muted-foreground">
              Phase 11 — Strategy, Social Content, Calendar, Ads, Landing Pages, Publishing &amp; Analytics
            </p>
          </div>
        </div>
        {statusMsg && <div className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium">{statusMsg}</div>}
      </div>

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Strategies', value: kpis.strategiesCount ?? 0 },
          { label: 'Campaigns', value: kpis.campaignsCount ?? 0 },
          { label: 'Social & Copy Assets', value: kpis.contentsCount ?? 0 },
          { label: 'Scheduled Items', value: kpis.scheduledCount ?? 0 },
          { label: 'Ad Campaigns', value: kpis.adCampaignsCount ?? 0 },
          { label: 'Landing Pages', value: kpis.landingPagesCount ?? 0 },
          { label: 'Connected Platforms', value: kpis.connectedPlatformsCount ?? 0 },
          { label: 'Reported CTR', value: `${kpis.overallCtrPct ?? 0}%` }
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
              <div className="mt-1 text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 12-View Navigation */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? 'default' : 'outline'}
              onClick={() => setTab(t.key)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading marketing studio...</div>}

      {!loading && tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => postAction('/strategies/generate', { mode: 'AUTOMATIC' }, 'Marketing Strategy')}>
                Generate Marketing Strategy
              </Button>
              <Button size="sm" variant="outline" onClick={() => postAction('/social/generate', {}, 'Social Suite')}>
                Generate 6-Platform Social Suite
              </Button>
              <Button size="sm" variant="outline" onClick={() => postAction('/landing-pages', {}, 'Landing Page')}>
                Generate Sanitized Landing Page
              </Button>
              <Button size="sm" variant="outline" onClick={() => postAction('/reports/generate', {}, 'Performance Report')}>
                Generate AI Performance Report
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Platform Integration Status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(data?.platformCapabilities || []).map((cap: any) => (
                <div key={cap.platform} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium">{cap.platform}</span>
                  <span className="text-xs text-muted-foreground">
                    {cap.supportsAutoPublish ? 'Auto-Publish Capable' : 'Manual / Ads Only'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && tab === 'strategist' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI Marketing Strategist</CardTitle>
            <Button size="sm" onClick={() => postAction('/strategies/generate', { mode: 'AUTOMATIC' }, 'Marketing Strategy')}>
              Generate Strategy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.strategies || []).map((s: any) => (
              <div key={s.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.title} ({s.mode})</span>
                  {s.isApproved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => postAction(`/strategies/${s.id}/approve`, {}, 'Approve Strategy')}>
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && (tab === 'social' || tab === 'copywriting') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tab === 'social' ? 'Social Media Studio' : 'AI Copywriting Studio'}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => postAction('/social/generate', {}, 'Social Suite')}>
                Generate Social Suite
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => postAction('/copywriting/generate', { contentType: 'AD_COPY', platform: 'INSTAGRAM', topic: 'Brand Launch' }, 'Copy Variants')}
              >
                Generate A/B/C Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.contents || []).map((c: any) => (
              <div key={c.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">[{c.platform}] {c.title}</span>
                  {!c.isApproved && (
                    <Button size="sm" variant="outline" onClick={() => postAction(`/contents/${c.id}/approve`, {}, 'Approve Content')}>
                      Approve
                    </Button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{c.caption}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && tab === 'calendar' && (
        <Card>
          <CardHeader><CardTitle>AI Content Calendar</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.scheduleItems || []).length === 0 && <p className="text-muted-foreground">No scheduled items yet.</p>}
            {(data?.scheduleItems || []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded border p-2">
                <span>[{item.platform}] {item.title}</span>
                <span className="text-xs text-muted-foreground">{new Date(item.scheduledAt).toLocaleString()} ({item.timezone})</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && tab === 'ads' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI Advertising Studio</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                postAction('/ads', { platform: 'META_ADS', name: 'Launch Awareness', objective: 'AWARENESS', dailyBudgetCents: 2500, durationDays: 14 }, 'Ad Campaign')
              }
            >
              Create Ad Plan + Estimator
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.adCampaigns || []).map((ad: any) => (
              <div key={ad.id} className="rounded border p-3">
                <div className="font-semibold">[{ad.platform}] {ad.name} — {ad.objective}</div>
                <div className="text-xs text-muted-foreground">Daily: {(ad.dailyBudgetCents / 100).toFixed(2)} {ad.currency} x {ad.durationDays} days</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && tab === 'campaigns' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>14-Stage Marketing Campaign Studio</CardTitle>
            <Button size="sm" onClick={() => postAction('/campaigns', { name: 'Q4 Brand Launch', objective: 'Brand Awareness & Leads' }, 'Campaign')}>
              Create Campaign
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.campaigns || []).map((camp: any) => (
              <div key={camp.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{camp.name} (Stage {camp.stage}/14 — {camp.status})</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => postAction(`/campaigns/${camp.id}/advance`, {}, 'Advance Stage')}>
                      Advance Stage
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => postAction(`/campaigns/${camp.id}/export`, {}, 'Export ZIP')}>
                      Export ZIP
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && tab === 'landing' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI Landing Page Studio (Sanitized HTML/CSS/JS)</CardTitle>
            <Button size="sm" onClick={() => postAction('/landing-pages', {}, 'Landing Page')}>
              Generate Landing Page
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.landingPages || []).map((lp: any) => (
              <div key={lp.id} className="rounded border p-3">
                <div className="font-semibold">{lp.title} ({lp.isSanitized ? 'Sanitized' : 'Raw'})</div>
                <div className="text-xs text-muted-foreground">Slug: {lp.slug}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && (tab === 'publishing' || tab === 'integrations') && (
        <Card>
          <CardHeader><CardTitle>{tab === 'publishing' ? 'Publishing Engine' : 'Platform Integration Manager'}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.connections || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border p-3">
                <span>[{c.platform}] {c.displayName} — {c.status}</span>
                {c.status === 'CONNECTED' && (
                  <Button size="sm" variant="outline" onClick={() => postAction(`/integrations/${c.id}/disconnect`, {}, 'Disconnect')}>
                    Disconnect &amp; Revoke
                  </Button>
                )}
              </div>
            ))}
            {(data?.publishingJobs || []).map((j: any) => (
              <div key={j.id} className="rounded border p-2 text-xs">
                [{j.platform}] Status: {j.status} | Platform Confirmed: {String(j.platformConfirmed)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && (tab === 'analytics' || tab === 'recommendations') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tab === 'analytics' ? 'Marketing Analytics & CSV Import' : 'AI Brand Growth Recommendations'}</CardTitle>
            <Button size="sm" onClick={() => postAction('/reports/generate', {}, 'Performance Report')}>
              Generate AI Report
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.recommendations || []).map((rec: any) => (
              <div key={rec.id} className="rounded border p-3">
                <div className="font-semibold">[{rec.priority}] {rec.title}</div>
                <p className="text-xs text-muted-foreground">{rec.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
