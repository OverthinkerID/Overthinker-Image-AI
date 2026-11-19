'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Eraser, History, Image as ImageIcon, Layers, Lock, Replace, Sliders, Sparkles, Upload, Wand2, Workflow } from 'lucide-react';
import { API_BASE } from '@/lib/api';

type TabKey = 'editor' | 'gen_fill' | 'bg_studio' | 'obj_replace' | 'enhance' | 'protected' | 'compare' | 'history' | 'workflows';

interface EditingProject {
  id: string;
  title: string;
  originalWidth: number;
  originalHeight: number;
  currentVersion: number;
  versions?: Array<{ id: string; version: number; operationType: string; width: number; height: number; changeNote: string | null; createdAt: string }>;
  protectedRegions?: Array<{ id: string; regionType: string; label: string; boundsJson: string }>;
  masks?: Array<{ id: string; name: string; maskType: string; featherPx: number }>;
}

export default function ImageEditorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [tab, setTab] = useState<TabKey>('editor');
  const [projects, setProjects] = useState<EditingProject[]>([]);
  const [active, setActive] = useState<EditingProject | null>(null);
  const [prompt, setPrompt] = useState('');
  const [bgPreset, setBgPreset] = useState('STUDIO');
  const [sliderPct, setSliderPct] = useState(50);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; presetType: string }>>([]);

  const base = `${API_BASE}/projects/${encodeURIComponent(projectId)}/image-editor`;
  const headers = (json = true) => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const loadList = async (selectId?: string) => {
    const [pRes, wRes] = await Promise.all([
      fetch(`${base}/projects`, { credentials: 'include', headers: headers() }),
      fetch(`${base}/workflows`, { credentials: 'include', headers: headers() }),
    ]);
    if (wRes.ok) setWorkflows((await wRes.json()).data || []);
    if (pRes.ok) {
      const list = (await pRes.json()).data || [];
      setProjects(list);
      const targetId = selectId || active?.id || list[0]?.id;
      if (targetId) {
        const dRes = await fetch(`${base}/projects/${encodeURIComponent(targetId)}`, { credentials: 'include', headers: headers() });
        if (dRes.ok) setActive((await dRes.json()).data);
      }
    }
  };

  useEffect(() => { void loadList(); }, [projectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${base}/projects/upload`, { method: 'POST', credentials: 'include', headers: headers(false), body: fd });
    if (res.ok) {
      const json = await res.json();
      await loadList(json.data.id);
    }
  };

  const navTabs: Array<{ key: TabKey; label: string; icon: typeof ImageIcon }> = [
    { key: 'editor', label: 'AI Image Editor', icon: ImageIcon },
    { key: 'gen_fill', label: 'Generative Fill', icon: Wand2 },
    { key: 'bg_studio', label: 'Background Studio', icon: Eraser },
    { key: 'obj_replace', label: 'Object Replacement', icon: Replace },
    { key: 'enhance', label: 'Image Enhancement', icon: Sparkles },
    { key: 'protected', label: 'Protected Regions', icon: Lock },
    { key: 'compare', label: 'Before & After', icon: Sliders },
    { key: 'history', label: 'Editing History', icon: History },
    { key: 'workflows', label: 'Workflow Library', icon: Workflow },
  ];

  const latestImgUrl = active ? `${base}/projects/${active.id}/versions/${active.currentVersion}/file` : '';
  const origImgUrl = active ? `${base}/projects/${active.id}/versions/1/file` : '';

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">AI Image & Design Editing Studio</h1>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground">
          <Upload className="h-3.5 w-3.5" /> Upload Image
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {navTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Toolbar */}
        <aside className="space-y-3 rounded-xl border bg-card p-4 text-xs lg:col-span-3">
          <div className="font-semibold">Editing Projects ({projects.length})</div>
          <div className="space-y-1.5">
            {projects.map((p) => (
              <button key={p.id} onClick={() => loadList(p.id)} className={`w-full rounded-md border px-2.5 py-2 text-left ${active?.id === p.id ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
                <div className="truncate">{p.title}</div>
                <div className="text-[11px] text-muted-foreground">v{p.currentVersion} · {p.originalWidth}×{p.originalHeight}</div>
              </button>
            ))}
          </div>

          {active && (
            <div className="space-y-2 border-t pt-3">
              <div className="font-semibold">Quick Non-Destructive Tools</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={async () => { await fetch(`${base}/projects/${active.id}/manual-edit`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ operation: 'ROTATE', angle: 90 }) }); loadList(active.id); }} className="rounded border px-2 py-1.5 hover:bg-muted">Rotate 90°</button>
                <button onClick={async () => { await fetch(`${base}/projects/${active.id}/manual-edit`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ operation: 'FLIP', flip: { horizontal: true } }) }); loadList(active.id); }} className="rounded border px-2 py-1.5 hover:bg-muted">Flip H</button>
                <button onClick={async () => { await fetch(`${base}/projects/${active.id}/enhance`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ mode: 'UPSCALE', factor: 2 }) }); loadList(active.id); }} className="rounded border px-2 py-1.5 hover:bg-muted">2x Upscale</button>
                <button onClick={async () => { await fetch(`${base}/projects/${active.id}/manual-edit`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ operation: 'RESTORE' }) }); loadList(active.id); }} className="rounded border px-2 py-1.5 hover:bg-muted">Restore Orig</button>
              </div>
            </div>
          )}
        </aside>

        {/* Central Canvas */}
        <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border bg-card p-5 lg:col-span-6">
          {!active ? (
            <p className="text-sm text-muted-foreground">Upload an image to start non-destructive AI & manual editing.</p>
          ) : tab === 'compare' ? (
            <div className="w-full space-y-3">
              <div className="relative mx-auto max-h-[380px] overflow-hidden rounded-lg border bg-background">
                <img src={latestImgUrl} alt="After" className="mx-auto max-h-[380px] object-contain" />
                <div className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-primary" style={{ width: `${sliderPct}%` }}>
                  <img src={origImgUrl} alt="Before" className="max-h-[380px] object-contain" />
                </div>
              </div>
              <input type="range" min={0} max={100} value={sliderPct} onChange={(e) => setSliderPct(Number(e.target.value))} className="w-full" />
            </div>
          ) : (
            <img src={latestImgUrl} alt={active.title} className="max-h-[400px] rounded-lg border object-contain" />
          )}
        </section>

        {/* Right Panel: Prompt, Properties, Layers & Version History */}
        <aside className="space-y-4 rounded-xl border bg-card p-4 text-xs lg:col-span-3">
          {active && (tab === 'gen_fill' || tab === 'obj_replace') && (
            <div className="space-y-2">
              <div className="font-semibold">{tab === 'gen_fill' ? 'Generative Fill' : 'Object Replacement'}</div>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Describe the edit..." className="w-full rounded-md border bg-background p-2 text-xs" />
              <button onClick={async () => { await fetch(`${base}/projects/${active.id}/generative-edit`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ jobType: tab === 'gen_fill' ? 'GEN_FILL' : 'OBJECT_REPLACE', prompt }) }); setPrompt(''); loadList(active.id); }} className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground">Run AI Edit</button>
            </div>
          )}

          {active && tab === 'bg_studio' && (
            <div className="space-y-2">
              <div className="font-semibold">AI Background Studio</div>
              <select value={bgPreset} onChange={(e) => setBgPreset(e.target.value)} className="w-full rounded-md border bg-background p-2">
                {['TRANSPARENT', 'SOLID', 'GRADIENT', 'STUDIO', 'LIFESTYLE', 'CORPORATE', 'LUXURY', 'NATURE'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={async () => { await fetch(`${base}/projects/${active.id}/background`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ mode: bgPreset === 'TRANSPARENT' ? 'BG_REMOVE' : 'BG_REPLACE', preset: bgPreset }) }); loadList(active.id); }} className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground">Apply Background</button>
            </div>
          )}

          {tab === 'workflows' && (
            <div className="space-y-2">
              <div className="font-semibold">Workflow Library</div>
              {workflows.map((w) => (
                <div key={w.id} className="rounded border p-2"><strong>{w.name}</strong> ({w.presetType})</div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-1.5 font-semibold"><Layers className="h-3.5 w-3.5" /> Version History</div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {(active?.versions || []).map((v) => (
                <div key={v.id} className="rounded border p-2">
                  <div className="font-medium">v{v.version} · {v.operationType}</div>
                  <div className="text-[11px] text-muted-foreground">{v.width}×{v.height} · {v.changeNote}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
