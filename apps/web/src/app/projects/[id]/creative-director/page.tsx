'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Brain, CheckCircle2, FileText, GitCompare, History, Layers, Send, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

type TabKey = 'director' | 'logo' | 'critic' | 'consistency' | 'recommendations' | 'briefs' | 'comparison' | 'reports' | 'history';

export default function CreativeDirectorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [tab, setTab] = useState<TabKey>('director');
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; provider: string }>>([]);
  const [assessments, setAssessments] = useState<Array<{ id: string; overallScore: number | null; disclaimer: string; categories: Array<{ id: string; label: string; score: number; judgmentType: string; explanation: string }> }>>([]);
  const [consistencyReports, setConsistencyReports] = useState<Array<{ id: string; consistencyScore: number; issuesJson: string }>>([]);
  const [recommendations, setRecommendations] = useState<Array<{ id: string; direction: string; title: string; description: string; priority: string; status: string }>>([]);
  const [briefs, setBriefs] = useState<Array<{ id: string; title: string; version: number; briefJson: string }>>([]);
  const [comparisons, setComparisons] = useState<Array<{ id: string; comparisonType: string; aiRecommendation: string; evaluationJson: string }>>([]);
  const [reports, setReports] = useState<Array<{ id: string; title: string; version: number; sectionsJson: string }>>([]);
  const [history, setHistory] = useState<Array<{ id: string; action: string; summary: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [direction, setDirection] = useState('Modern Minimalist');

  const headers = () => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { 'Content-Type': 'application/json', ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const base = `${API_BASE}/projects/${encodeURIComponent(projectId)}/creative-director`;

  const loadAll = async () => {
    const h = headers();
    const [ctxR, sessR, assR, conR, recR, brR, cmpR, repR, histR] = await Promise.all([
      fetch(`${base}/context`, { credentials: 'include', headers: h }),
      fetch(`${base}/sessions`, { credentials: 'include', headers: h }),
      fetch(`${base}/assessments`, { credentials: 'include', headers: h }),
      fetch(`${base}/consistency-reports`, { credentials: 'include', headers: h }),
      fetch(`${base}/recommendations`, { credentials: 'include', headers: h }),
      fetch(`${base}/briefs`, { credentials: 'include', headers: h }),
      fetch(`${base}/comparisons`, { credentials: 'include', headers: h }),
      fetch(`${base}/reports`, { credentials: 'include', headers: h }),
      fetch(`${base}/history`, { credentials: 'include', headers: h }),
    ]);
    if (ctxR.ok) setContext((await ctxR.json()).data);
    if (sessR.ok) {
      const sessions = (await sessR.json()).data || [];
      setMessages(sessions[0]?.messages || []);
    }
    if (assR.ok) setAssessments((await assR.json()).data || []);
    if (conR.ok) setConsistencyReports((await conR.json()).data || []);
    if (recR.ok) setRecommendations((await recR.json()).data || []);
    if (brR.ok) setBriefs((await brR.json()).data || []);
    if (cmpR.ok) setComparisons((await cmpR.json()).data || []);
    if (repR.ok) setReports((await repR.json()).data || []);
    if (histR.ok) setHistory((await histR.json()).data || []);
  };

  useEffect(() => { void loadAll(); }, [projectId]);

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await fetch(`${base}/chat`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ message: chatInput }) });
    setChatInput('');
    loadAll();
  };

  const navTabs: Array<{ key: TabKey; label: string; icon: typeof Brain }> = [
    { key: 'director', label: 'Creative Director', icon: Brain },
    { key: 'logo', label: 'Logo Intelligence', icon: Sparkles },
    { key: 'critic', label: 'Design Critic', icon: Wand2 },
    { key: 'consistency', label: 'Brand Consistency', icon: ShieldCheck },
    { key: 'recommendations', label: 'Recommendations', icon: CheckCircle2 },
    { key: 'briefs', label: 'Creative Briefs', icon: FileText },
    { key: 'comparison', label: 'Brand Comparison', icon: GitCompare },
    { key: 'reports', label: 'Intelligence Reports', icon: Layers },
    { key: 'history', label: 'Assessment History', icon: History },
  ];

  const latestAssessment = assessments[0];
  const latestConsistency = consistencyReports[0];
  const pendingRecs = recommendations.filter((r) => r.status === 'PENDING').length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">AI Creative Director & Brand Intelligence</h1>
          <p className="text-xs text-muted-foreground">Advisory brand critique, deterministic visual scoring, consistency auditing, and creative direction briefs.</p>
        </div>
      </div>

      {/* Dashboard Widgets */}
      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Overall Assessment (Advisory)</div>
          <div className="mt-1 text-2xl font-semibold">{latestAssessment?.overallScore ?? '—'}/100</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Brand Consistency</div>
          <div className="mt-1 text-2xl font-semibold">{latestConsistency?.consistencyScore ?? '—'}/100</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Pending Recommendations</div>
          <div className="mt-1 text-2xl font-semibold">{pendingRecs}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Recent Evaluations</div>
          <div className="mt-1 text-2xl font-semibold">{history.length}</div>
        </div>
      </section>

      {/* 9-Tab Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {navTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'director' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-xl border bg-card p-5 lg:col-span-2">
            <h2 className="font-semibold">Creative Director Consultation</h2>
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border bg-background/50 p-4 text-sm">
              {messages.length === 0 ? <p className="text-xs text-muted-foreground">Ask the Creative Director to critique your brand, compare concepts, or suggest improvements.</p> : messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-3 ${m.role === 'USER' ? 'ml-8 bg-primary/10' : 'mr-8 border bg-card'}`}>
                  <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{m.role} · {m.provider}</div>
                  <div className="whitespace-pre-wrap text-xs">{m.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask for creative critique or direction..." className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Send className="h-4 w-4" /> Send</button>
            </form>
          </div>
          <div className="rounded-xl border bg-card p-5 text-xs space-y-2">
            <h3 className="text-sm font-semibold">Project Context Grounding</h3>
            <p><strong>DNA:</strong> {String(context?.activeDnaLabel || '—')}</p>
            <p><strong>Concept:</strong> {String(context?.activeConceptLabel || '—')}</p>
            <p><strong>Original Logos:</strong> {String(context?.originalLogosCount ?? 0)}</p>
            <p><strong>Variations:</strong> {String(context?.variationsCount ?? 0)}</p>
          </div>
        </div>
      )}

      {tab === 'logo' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Logo Intelligence Evaluation</h2>
            <button onClick={async () => { await fetch(`${base}/logo-intelligence`, { method: 'POST', credentials: 'include', headers: headers(), body: '{}' }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Run Logo Evaluation</button>
          </div>
          {latestAssessment && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{latestAssessment.disclaimer}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {latestAssessment.categories.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold"><span>{c.label}</span><span>{c.score}/100</span></div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{c.judgmentType}</div>
                    <p className="mt-1">{c.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'consistency' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Brand Consistency Intelligence</h2>
            <button onClick={async () => { await fetch(`${base}/consistency`, { method: 'POST', credentials: 'include', headers: headers() }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Run Consistency Audit</button>
          </div>
          {latestConsistency && (
            <div className="space-y-2 text-xs">
              {(JSON.parse(latestConsistency.issuesJson || '[]') as Array<{ severity: string; area: string; message: string; recommendation: string }>).map((iss, idx) => (
                <div key={idx} className="rounded-lg border p-3"><strong>[{iss.severity}] {iss.area}</strong>: {iss.message} — <em>{iss.recommendation}</em></div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'recommendations' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Intelligent Design Recommendations</h2>
            <div className="flex gap-2">
              <select value={direction} onChange={(e) => setDirection(e.target.value)} className="rounded-md border bg-background px-2.5 py-1.5 text-xs">
                {['Modern Minimalist', 'Premium Luxury', 'Corporate Professional', 'Creative Futuristic', 'Elegant Classic', 'Bold Contemporary', 'Friendly and Approachable', 'Editorial', 'Organic and Natural'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button onClick={async () => { await fetch(`${base}/recommendations/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ direction }) }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Generate</button>
            </div>
          </div>
          <div className="space-y-3">
            {recommendations.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 text-xs">
                <div className="flex items-center justify-between"><strong className="text-sm">{r.title}</strong><span className="rounded border px-2 py-0.5">{r.priority} · {r.status}</span></div>
                <p className="mt-1 text-muted-foreground">{r.description}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={async () => { await fetch(`${base}/recommendations/${r.id}`, { method: 'PATCH', credentials: 'include', headers: headers(), body: JSON.stringify({ status: 'ACCEPTED' }) }); loadAll(); }} className="rounded border px-2 py-1 hover:bg-muted">Accept</button>
                  <button onClick={async () => { await fetch(`${base}/recommendations/${r.id}`, { method: 'PATCH', credentials: 'include', headers: headers(), body: JSON.stringify({ status: 'REJECTED' }) }); loadAll(); }} className="rounded border px-2 py-1 hover:bg-muted">Reject</button>
                  <button onClick={async () => { await fetch(`${base}/recommendations/${r.id}`, { method: 'PATCH', credentials: 'include', headers: headers(), body: JSON.stringify({ status: 'SAVED_FOR_LATER' }) }); loadAll(); }} className="rounded border px-2 py-1 hover:bg-muted">Save for Later</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'briefs' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Creative Direction Briefs</h2>
            <button onClick={async () => { await fetch(`${base}/briefs/generate`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ direction }) }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Generate Brief</button>
          </div>
          {briefs.map((b) => <div key={b.id} className="rounded-lg border p-4 text-xs"><strong>{b.title}</strong><pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{b.briefJson}</pre></div>)}
        </div>
      )}

      {tab === 'comparison' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Brand Comparison Engine</h2>
            <button onClick={async () => { await fetch(`${base}/comparisons`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ comparisonType: 'CONCEPTS' }) }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Compare Concepts</button>
          </div>
          {comparisons.map((c) => <div key={c.id} className="rounded-lg border p-4 text-xs"><strong>{c.comparisonType}</strong><p className="mt-1">{c.aiRecommendation}</p></div>)}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Brand Intelligence Reports (12 Sections)</h2>
            <button onClick={async () => { await fetch(`${base}/reports/generate`, { method: 'POST', credentials: 'include', headers: headers() }); loadAll(); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Generate Report</button>
          </div>
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border p-4 text-xs">
              <strong>{r.title}</strong>
              <form method="POST" action={`${base}/reports/${r.id}/export/pdf`} target="_blank">
                <button type="submit" className="rounded border px-3 py-1.5 hover:bg-muted">Export PDF</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {(tab === 'critic' || tab === 'history') && (
        <div className="space-y-3 rounded-xl border bg-card p-5 text-xs">
          <h2 className="text-sm font-semibold">{tab === 'critic' ? 'Visual Design Critic' : 'Assessment History'}</h2>
          {history.length === 0 ? <p className="text-muted-foreground">No evaluations recorded yet.</p> : history.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <span><strong>{h.action}</strong> — {h.summary}</span>
              <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
