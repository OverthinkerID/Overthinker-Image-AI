'use client';
import * as React from 'react';
import { CheckCircle2, Cpu, Download, Layers, Pause, Play, RefreshCw, ShieldCheck, SkipForward, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE } from '@/lib/api';

interface WorkflowStep { id: string; stepOrder: number; stepKey: string; name: string; isOptional: boolean; status: string; errorMessage: string | null; }
interface WorkflowApproval { id: string; stepKey: string; status: string; comment: string | null; }
interface Workflow { id: string; name: string; mode: string; status: string; currentStepIdx: number; steps: WorkflowStep[]; approvals: WorkflowApproval[]; }
interface BatchJob { id: string; category: string; outputCount: number; concurrencyLimit: number; status: string; progress: number; }
interface QualityReport { id: string; overallScore: number; passed: boolean; checksJson: string; disclaimer: string; }
interface ConsistencyReport { id: string; consistencyScore: number; resultsJson: string; warningsJson: string; errorsJson: string; correctionsJson: string; }
interface ExportPkg { id: string; name: string; status: string; fileSize: number; createdAt: string; items: Array<{ id: string; folderPath: string }>; }

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, cache: 'no-store' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || `HTTP ${res.status}`);
  return payload.data as T;
}

export function AutomationDashboardWorkspace({ projectId }: { projectId: string }) {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [batchJobs, setBatchJobs] = React.useState<BatchJob[]>([]);
  const [qualityReports, setQualityReports] = React.useState<QualityReport[]>([]);
  const [consistencyReports, setConsistencyReports] = React.useState<ConsistencyReport[]>([]);
  const [exportPackages, setExportPackages] = React.useState<ExportPkg[]>([]);
  const [mode, setMode] = React.useState<'AUTOMATIC' | 'SEMI_AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
  const [batchCategory, setBatchCategory] = React.useState('SOCIAL_MEDIA');
  const [batchCount, setBatchCount] = React.useState('4');
  const [concurrency, setConcurrency] = React.useState('1');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    const [wfs, bjs, qrs, crs, pkgs] = await Promise.all([
      apiJson<Workflow[]>(`/projects/${projectId}/workflows`),
      apiJson<BatchJob[]>(`/projects/${projectId}/batch-jobs`),
      apiJson<QualityReport[]>(`/projects/${projectId}/quality-reports`),
      apiJson<ConsistencyReport[]>(`/projects/${projectId}/consistency-reports`),
      apiJson<ExportPkg[]>(`/projects/${projectId}/export-packages`),
    ]);
    setWorkflows(wfs); setBatchJobs(bjs); setQualityReports(qrs); setConsistencyReports(crs); setExportPackages(pkgs);
  }, [projectId]);

  React.useEffect(() => { void loadAll(); }, [loadAll]);

  const activeWfCount = workflows.filter((w) => ['RUNNING', 'QUEUED', 'WAITING_APPROVAL', 'PAUSED'].includes(w.status)).length;
  const completedWfCount = workflows.filter((w) => w.status === 'COMPLETED').length;
  const failedWfCount = workflows.filter((w) => w.status === 'FAILED').length;
  const waitingApprovals = workflows.flatMap((w) => w.approvals.filter((a) => a.status === 'PENDING').map((a) => ({ ...a, workflowId: w.id, workflowName: w.name })));

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</div>}

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Active / Waiting</p><p className="mt-1 text-2xl font-semibold">{activeWfCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Completed Pipelines</p><p className="mt-1 text-2xl font-semibold">{completedWfCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Failed Pipelines</p><p className="mt-1 text-2xl font-semibold">{failedWfCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Waiting Approvals</p><p className="mt-1 text-2xl font-semibold">{waitingApprovals.length}</p></CardContent></Card>
      </div>

      {/* Operation Modes & Workflow Launcher */}
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" />Workflow Automation Manager</CardTitle><CardDescription>Durable SQLite-persisted 13-stage pipelines across Automatic, Semi-Automatic, and Manual modes.</CardDescription></div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 rounded-md border bg-background/60 px-3 text-sm">
              <option value="AUTOMATIC">Automatic Mode</option>
              <option value="SEMI_AUTOMATIC">Semi-Automatic (Checkpoints)</option>
              <option value="MANUAL">Manual Mode</option>
            </select>
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                const wf = await apiJson<Workflow>(`/projects/${projectId}/workflows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
                if (mode !== 'MANUAL') await apiJson(`/projects/${projectId}/workflows/${wf.id}/start`, { method: 'POST' });
                setMessage(`Created ${mode} workflow.`);
                await loadAll();
              } finally { setBusy(false); }
            }}><Play className="h-4 w-4" />Create & Run Workflow</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {waitingApprovals.map((ap) => (
            <div key={ap.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <span><strong>Approval Checkpoint:</strong> {ap.workflowName} → {ap.stepKey}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${ap.workflowId}/approvals/${ap.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'APPROVED' }) }); await loadAll(); }}>Approve & Resume</Button>
                <Button size="sm" variant="outline" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${ap.workflowId}/approvals/${ap.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'REJECTED' }) }); await loadAll(); }}>Reject</Button>
              </div>
            </div>
          ))}

          {workflows.map((wf) => (
            <div key={wf.id} className="space-y-3 rounded-lg border bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{wf.name}</p><p className="text-xs text-muted-foreground">Mode: {wf.mode} · Step {wf.currentStepIdx + 1}/{wf.steps.length}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant={wf.status === 'COMPLETED' ? 'success' : wf.status === 'FAILED' ? 'outline' : 'warning'}>{wf.status}</Badge>
                  <Button size="sm" variant="outline" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${wf.id}/pause`, { method: 'POST' }); await loadAll(); }}><Pause className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${wf.id}/resume`, { method: 'POST' }); await loadAll(); }}><Play className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${wf.id}/cancel`, { method: 'POST' }); await loadAll(); }}><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {wf.steps.map((st) => (
                  <div key={st.id} className="flex items-center justify-between rounded border px-2 py-1 text-[11px]">
                    <span className="truncate">{st.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{st.status}</span>
                      {st.status === 'FAILED' && <button type="button" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${wf.id}/steps/${st.stepKey}/retry`, { method: 'POST' }); await loadAll(); }} title="Retry"><RefreshCw className="h-3 w-3" /></button>}
                      {st.isOptional && st.status === 'QUEUED' && <button type="button" onClick={async () => { await apiJson(`/projects/${projectId}/workflows/${wf.id}/steps/${st.stepKey}/skip`, { method: 'POST' }); await loadAll(); }} title="Skip"><SkipForward className="h-3 w-3" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Batch Generation & QC */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" />Batch Generation (GPU-Safe Concurrency)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Category</Label><select value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)} className="mt-1 flex h-9 w-full rounded-md border bg-background/60 px-2 text-xs"><option value="LOGO_VARIATION">Logo Variations</option><option value="SOCIAL_MEDIA">Social Media</option><option value="STATIONERY">Stationery</option><option value="PACKAGING">Packaging</option><option value="MARKETING">Marketing</option><option value="MOCKUP">Mockups</option><option value="PRESENTATION">Presentations</option></select></div>
              <div><Label>Outputs</Label><Input type="number" className="mt-1" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} /></div>
              <div><Label>Concurrency</Label><Input type="number" min="1" max="4" className="mt-1" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={async () => { await apiJson(`/projects/${projectId}/batch-jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: batchCategory, outputCount: Number(batchCount), concurrencyLimit: Number(concurrency) }) }); setMessage('Batch generation completed.'); await loadAll(); }}>Run Batch Job</Button>
            <div className="space-y-1.5">{batchJobs.slice(0, 5).map((b) => <div key={b.id} className="flex justify-between rounded border px-2.5 py-1.5"><span>{b.category} ({b.outputCount} items · conc={b.concurrencyLimit})</span><Badge variant={b.status === 'COMPLETED' ? 'success' : 'secondary'}>{b.status}</Badge></div>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-400" />Quality Control & Brand Consistency</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={async () => { await apiJson(`/projects/${projectId}/quality-reports/run`, { method: 'POST' }); await loadAll(); }}>Run Quality Check</Button>
              <Button variant="outline" className="flex-1" onClick={async () => { await apiJson(`/projects/${projectId}/consistency-reports/run`, { method: 'POST' }); await loadAll(); }}>Run Consistency Check</Button>
            </div>
            {qualityReports[0] && <div className="rounded border bg-background/50 p-3"><p className="font-semibold">Latest Quality Score: {qualityReports[0].overallScore}/100 ({qualityReports[0].passed ? 'PASS' : 'NEEDS ATTENTION'})</p><p className="mt-1 text-[11px] text-muted-foreground">{qualityReports[0].disclaimer}</p></div>}
            {consistencyReports[0] && <div className="rounded border bg-background/50 p-3"><p className="font-semibold">Latest Brand Consistency Score: {consistencyReports[0].consistencyScore}/100</p></div>}
          </CardContent>
        </Card>
      </div>

      {/* Commercial Export Center */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" />Commercial Export Center (14-Folder BrandPackage)</CardTitle><CardDescription>Structured ZIP with 01_Original_Logo through 14_Metadata/manifest.json.</CardDescription></div>
          <Button onClick={async () => { await apiJson(`/projects/${projectId}/export-packages`, { method: 'POST' }); setMessage('Built Commercial BrandPackage ZIP.'); await loadAll(); }}>Build Commercial BrandPackage</Button>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {exportPackages.map((pkg) => (
            <div key={pkg.id} className="flex items-center justify-between rounded border bg-background/50 px-3 py-2">
              <span>{pkg.name} · {pkg.items.length} files · {Math.round(pkg.fileSize / 1024)} KB</span>
              <a href={`${API_BASE}/projects/${projectId}/export-packages/${pkg.id}/download`} className="inline-flex items-center gap-1 rounded border px-2.5 py-1 hover:bg-accent"><Download className="h-3.5 w-3.5" />Download ZIP</a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
