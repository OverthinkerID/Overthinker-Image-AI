'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Film,
  Layers,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type VideoTab = 'overview' | 'generator' | 'templates' | 'logo-anim' | 'storyboard' | 'voice' | 'timeline' | 'render' | 'qc';

export default function VideoStudioPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id || '';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [tab, setTab] = useState<VideoTab>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/video/overview`, { credentials: 'include' });
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
    const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/video${path}`, {
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

  const activeVp = data?.videoProjects?.[0];
  const activeTimeline = activeVp?.timelines?.[0];

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
            <h1 className="text-2xl font-bold">AI Brand Video &amp; Motion Studio</h1>
            <p className="text-sm text-muted-foreground">
              Phase 12 — Templates, Storyboard, Deterministic Logo Animation, Voice/TTS, Multi-Track Timeline &amp; FFmpeg Render
            </p>
          </div>
        </div>
        {statusMsg && <div className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium">{statusMsg}</div>}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {[
          { key: 'overview', label: 'Overview', icon: Video },
          { key: 'templates', label: '12 Brand Templates', icon: Layers },
          { key: 'generator', label: 'AI Video Generator', icon: Sparkles },
          { key: 'logo-anim', label: 'Logo Animation', icon: Clapperboard },
          { key: 'storyboard', label: 'Script & Storyboard', icon: Film },
          { key: 'voice', label: 'Voice & Subtitles', icon: Mic },
          { key: 'timeline', label: 'Multi-Track Timeline', icon: Play },
          { key: 'render', label: 'Render & Export', icon: Video },
          { key: 'qc', label: 'Video QC', icon: ShieldCheck }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key as VideoTab)}>
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading video studio...</div>}

      {!loading && tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Quick Video Project Setup</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => postAction('/projects', { title: 'Brand Launch Video', templateKey: 'LOGO_INTRO', aspectRatio: '16:9' }, 'Create Video Project')}
              >
                Create 16:9 Brand Video Project
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => postAction('/logo-animation', { videoProjectId: activeVp?.id, animationStyle: 'FADE_AND_SCALE' }, 'Logo Animation')}
              >
                Generate Deterministic Logo Animation
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Discovered Video Providers</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(data?.providers || []).map((prov: any) => (
                <div key={prov.provider} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium">{prov.provider} ({prov.mode})</span>
                  <span className="text-xs text-muted-foreground">{prov.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && tab === 'templates' && (
        <div className="grid gap-3 md:grid-cols-3">
          {(data?.templates || []).map((tpl: any) => (
            <Card key={tpl.key}>
              <CardContent className="p-4">
                <div className="font-semibold">{tpl.name}</div>
                <div className="text-xs text-muted-foreground">{tpl.aspectRatio} · {tpl.durationSec}s</div>
                <Button
                  size="sm"
                  className="mt-3"
                  variant="outline"
                  onClick={() => postAction('/projects', { title: tpl.name, templateKey: tpl.key, aspectRatio: tpl.aspectRatio, durationSec: tpl.durationSec }, `Create ${tpl.name}`)}
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && tab === 'timeline' && (
        <Card>
          <CardHeader><CardTitle>Multi-Track Video Timeline Editor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!activeTimeline && <p className="text-sm text-muted-foreground">Create a Video Project first to inspect its 5-track timeline.</p>}
            {activeTimeline && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {activeTimeline.title} · {activeTimeline.width}x{activeTimeline.height} @ {activeTimeline.fps}fps · {activeTimeline.durationSec}s
                </div>
                {(activeTimeline.tracks || []).map((track: any) => (
                  <div key={track.id} className="rounded border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>[{track.trackType}] {track.name}</span>
                      <span>{track.clips?.length || 0} clips</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(track.clips || []).map((clip: any) => (
                        <div key={clip.id} className="rounded bg-primary/15 px-2.5 py-1 text-xs">
                          {clip.label} ({clip.startSec}s - {clip.startSec + clip.durationSec}s)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && tab === 'render' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Render &amp; Export Center</CardTitle>
            {activeVp && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => postAction(`/projects/${activeVp.id}/render`, { format: 'MP4', aspectRatio: '16:9' }, 'Render MP4')}>
                  Render MP4 (16:9)
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction(`/projects/${activeVp.id}/render`, { format: 'WEBM', aspectRatio: '9:16' }, 'Render WebM')}>
                  Render WebM Alpha (9:16)
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.renderJobs || []).map((rj: any) => (
              <div key={rj.id} className="flex items-center justify-between rounded border p-3">
                <span>{rj.format} ({rj.width}x{rj.height}) — Alpha: {String(rj.supportsAlpha)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {rj.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && (tab === 'generator' || tab === 'logo-anim' || tab === 'storyboard' || tab === 'voice' || tab === 'qc') && (
        <Card>
          <CardHeader><CardTitle className="capitalize">{tab.replace('-', ' ')} Controls</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => postAction('/jobs', { videoProjectId: activeVp?.id, jobType: 'IMAGE_TO_VIDEO', prompt: 'Brand showcase motion' }, 'Video Job')}>
                Queue AI Video Job
              </Button>
              {activeVp && (
                <>
                  <Button size="sm" variant="outline" onClick={() => postAction(`/projects/${activeVp.id}/storyboard`, { language: 'id-ID' }, 'Storyboard')}>
                    Generate Indonesian Script &amp; Storyboard
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      postAction('/voice-audio', { profileName: 'Brand Narrator', language: 'id-ID', consentGranted: true, timelineId: activeTimeline?.id }, 'Voice & Subtitles')
                    }
                  >
                    Generate Voiceover &amp; SRT
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => postAction(`/projects/${activeVp.id}/qc`, {}, 'Video QC')}>
                    Run Video Quality Check
                  </Button>
                </>
              )}
            </div>
            {(data?.qcReports || []).map((q: any) => (
              <div key={q.id} className="rounded border p-3 text-xs">
                QC Score: {q.overallScore}/100 — {q.passed ? 'PASSED' : 'NEEDS REVIEW'}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
