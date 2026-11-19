'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Compass, FileText, Globe, Layers, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { API_BASE } from '@/lib/api';

type ViewKey =
  | 'dashboard'
  | 'industry'
  | 'competitors'
  | 'comparison'
  | 'audience'
  | 'personas'
  | 'journey'
  | 'positioning'
  | 'naming'
  | 'taglines'
  | 'recommendations'
  | 'report'
  | 'history';

export default function StrategyStudioPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [view, setView] = useState<ViewKey>('dashboard');
  const [researches, setResearches] = useState<Array<{ id: string; brandName: string; industry: string; status: string; createdAt: string }>>([]);
  const [competitors, setCompetitors] = useState<Array<{ id: string; name: string; competitorType: string; positioning: string | null; priceTier: string | null; dataProvenance: string }>>([]);
  const [personas, setPersonas] = useState<Array<{ id: string; personaName: string; occupation: string | null; dataSourceType: string; expectations: string | null }>>([]);
  const [positionings, setPositionings] = useState<Array<{ id: string; version: number; positioningStmt: string; uvp: string; usp: string; isApproved: boolean }>>([]);
  const [names, setNames] = useState<Array<{ id: string; category: string; brandName: string; meaning: string; domainCheckStatus: string; isFavorite: boolean; isApproved: boolean }>>([]);
  const [taglines, setTaglines] = useState<Array<{ id: string; tagline: string; tone: string; meaning: string; isFavorite: boolean; isApproved: boolean }>>([]);
  const [reports, setReports] = useState<Array<{ id: string; title: string; version: number; isApproved: boolean; sectionsJson: string }>>([]);
  const [compName, setCompName] = useState('');
  const [compPos, setCompPos] = useState('');

  const base = `${API_BASE}/projects/${encodeURIComponent(projectId)}/strategy`;
  const headers = () => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { 'Content-Type': 'application/json', ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const loadAll = async () => {
    const h = headers();
    const [rR, cR, pR, posR, nR, tR, repR] = await Promise.all([
      fetch(`${base}/market-research/projects`, { credentials: 'include', headers: h }),
      fetch(`${base}/competitors`, { credentials: 'include', headers: h }),
      fetch(`${base}/audience/personas`, { credentials: 'include', headers: h }),
      fetch(`${base}/brand-positioning`, { credentials: 'include', headers: h }),
      fetch(`${base}/naming`, { credentials: 'include', headers: h }),
      fetch(`${base}/taglines`, { credentials: 'include', headers: h }),
      fetch(`${base}/strategy-reports`, { credentials: 'include', headers: h }),
    ]);
    if (rR.ok) setResearches((await rR.json()).data || []);
    if (cR.ok) setCompetitors((await cR.json()).data || []);
    if (pR.ok) setPersonas((await pR.json()).data || []);
    if (posR.ok) setPositionings((await posR.json()).data || []);
    if (nR.ok) setNames((await nR.json()).data || []);
    if (tR.ok) setTaglines((await tR.json()).data || []);
    if (repR.ok) setReports((await repR.json()).data || []);
  };

  useEffect(() => { void loadAll(); }, [projectId]);

  const navItems: Array<{ key: ViewKey; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'industry', label: 'Industry Research' },
    { key: 'competitors', label: 'Competitors' },
    { key: 'comparison', label: 'Comparison' },
    { key: 'audience', label: 'Audience' },
    { key: 'personas', label: 'Personas' },
    { key: 'journey', label: 'Customer Journey' },
    { key: 'positioning', label: 'Positioning' },
    { key: 'naming', label: 'Naming Studio' },
    { key: 'taglines', label: 'Tagline Studio' },
    { key: 'recommendations', label: 'Recommendations' },
    { key: 'report', label: 'Strategy Report' },
    { key: 'history', label: 'History' },
  ];

  const approvedPos = positionings.filter((p) => p.isApproved).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Market Research & Brand Strategy Intelligence</h1>
        </div>
        <button
          onClick={async () => {
            const wf = await fetch(`${base}/workflows`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ mode: 'AUTOMATIC' }) }).then((r) => r.json());
            if (wf?.data?.id) await fetch(`${base}/workflows/${wf.data.id}/start`, { method: 'POST', credentials: 'include', headers: headers() });
            loadAll();
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" /> Run Full Strategy Pipeline
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-6">
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Research</div><div className="mt-1 text-xl font-semibold">{researches.length}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Target className="h-3.5 w-3.5" /> Competitors</div><div className="mt-1 text-xl font-semibold">{competitors.length}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3.5 w-3.5" /> Personas</div><div className="mt-1 text-xl font-semibold">{personas.length}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Compass className="h-3.5 w-3.5" /> Approved Pos.</div><div className="mt-1 text-xl font-semibold">{approvedPos}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Names</div><div className="mt-1 text-xl font-semibold">{names.length}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Reports</div><div className="mt-1 text-xl font-semibold">{reports.length}</div></div>
      </section>

      {/* 13-View Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {navItems.map((n) => (
          <button key={n.key} onClick={() => setView(n.key)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${view === n.key ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground hover:text-foreground'}`}>
            {n.label}
          </button>
        ))}
      </div>

      {(view === 'competitors' || view === 'comparison') && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Competitor Intelligence</h2>
            <form onSubmit={async (e) => { e.preventDefault(); await fetch(`${base}/competitors`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ name: compName, positioning: compPos }) }); setCompName(''); setCompPos(''); loadAll(); }} className="flex gap-2">
              <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="Competitor name" required className="rounded border bg-background px-2.5 py-1 text-xs" />
              <input value={compPos} onChange={(e) => setCompPos(e.target.value)} placeholder="Positioning" className="rounded border bg-background px-2.5 py-1 text-xs" />
              <button type="submit" className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Add</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b text-muted-foreground"><th className="py-2">Name</th><th>Type</th><th>Positioning</th><th>Price Tier</th><th>Provenance</th></tr></thead>
              <tbody>
                {competitors.map((c) => <tr key={c.id} className="border-b"><td className="py-2 font-medium">{c.name}</td><td>{c.competitorType}</td><td>{c.positioning || '—'}</td><td>{c.priceTier || 'Unavailable'}</td><td>{c.dataProvenance}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(view === 'personas' || view === 'audience' || view === 'journey') && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Audience & Customer Personas</h2>
            <button onClick={async () => { await fetch(`${base}/audience/personas/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: '{}' }); loadAll(); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Generate Personas</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {personas.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 text-xs">
                <div className="flex items-center justify-between font-semibold"><span>{p.personaName}</span><span className="rounded border px-2 py-0.5 text-[10px]">{p.dataSourceType}</span></div>
                <p className="mt-1 text-muted-foreground">{p.occupation} · {p.expectations}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'positioning' && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Brand Positioning Studio</h2>
            <button onClick={async () => { await fetch(`${base}/brand-positioning/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: '{}' }); loadAll(); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Generate Positioning</button>
          </div>
          {positionings.map((p) => (
            <div key={p.id} className="space-y-2 rounded-lg border p-4 text-xs">
              <div className="flex items-center justify-between"><strong>Version {p.version}</strong><button onClick={async () => { await fetch(`${base}/brand-positioning/${p.id}/approve`, { method: 'POST', credentials: 'include', headers: headers() }); loadAll(); }} className="rounded border px-2.5 py-1">{p.isApproved ? 'Approved' : 'Approve'}</button></div>
              <p><strong>Positioning:</strong> {p.positioningStmt}</p>
              <p><strong>UVP:</strong> {p.uvp}</p>
              <p><strong>USP:</strong> {p.usp}</p>
            </div>
          ))}
        </section>
      )}

      {view === 'naming' && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">AI Naming Studio ({names.length})</h2>
            <button onClick={async () => { await fetch(`${base}/naming/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: '{}' }); loadAll(); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Generate 10 Names</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {names.map((n) => (
              <div key={n.id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between font-semibold"><span>{n.brandName} ({n.category})</span><span className="text-[10px] text-muted-foreground">{n.domainCheckStatus}</span></div>
                <p className="mt-1 text-muted-foreground">{n.meaning}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'taglines' && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">AI Tagline Studio ({taglines.length})</h2>
            <button onClick={async () => { await fetch(`${base}/taglines/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: '{}' }); loadAll(); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Generate 10 Taglines</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {taglines.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 text-xs">
                <div className="font-semibold">{t.tagline}</div>
                <p className="mt-1 text-muted-foreground">{t.tone} · {t.meaning}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(view === 'report' || view === 'dashboard' || view === 'industry' || view === 'recommendations' || view === 'history') && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Layers className="h-4 w-4 text-primary" /> Brand Strategy Reports (22 Sections)</h2>
            <button onClick={async () => { await fetch(`${base}/strategy-reports/generate`, { method: 'POST', credentials: 'include', headers: headers() }); loadAll(); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Generate 22-Section Report</button>
          </div>
          {reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 text-xs">
              <strong>{r.title} {r.isApproved ? '· Approved' : ''}</strong>
              <div className="flex gap-2">
                <a href={`${base}/strategy-reports/${r.id}/export?format=PDF`} target="_blank" className="rounded border px-2.5 py-1 hover:bg-muted">PDF</a>
                <a href={`${base}/strategy-reports/${r.id}/export?format=DOCX`} target="_blank" className="rounded border px-2.5 py-1 hover:bg-muted">DOCX</a>
                <a href={`${base}/strategy-reports/${r.id}/export?format=JSON`} target="_blank" className="rounded border px-2.5 py-1 hover:bg-muted">JSON</a>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
