'use client';
import * as React from 'react';
import { Activity, CheckCircle2, Cpu, Heart, Lock, Maximize2, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getConceptAssetUrl, type AiJob, type AiProviderConfig, type BrandConcept, type ComfyWorkflowTemplate } from '@/lib/api';

function safeParse<T>(json: string, fallback: T): T { try { return JSON.parse(json) as T; } catch { return fallback; } }

export function ConceptStudioPanel({ projectId }: { projectId: string }) {
  const [providers, setProviders] = React.useState<AiProviderConfig[]>([]);
  const [workflows, setWorkflows] = React.useState<ComfyWorkflowTemplate[]>([]);
  const [concepts, setConcepts] = React.useState<BrandConcept[]>([]);
  const [jobs, setJobs] = React.useState<AiJob[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState('heuristic');
  const [selectedWorkflow, setSelectedWorkflow] = React.useState('');
  const [steps, setSteps] = React.useState('24');
  const [cfg, setCfg] = React.useState('7.0');
  const [generating, setGenerating] = React.useState(false);
  const [testingProvider, setTestingProvider] = React.useState(false);
  const [previewConcept, setPreviewConcept] = React.useState<BrandConcept | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    try {
      const [provList, wfList, conceptList, jobList] = await Promise.all([api.listAiProviders(), api.listWorkflows(), api.listConcepts(projectId), api.listAiJobs(projectId)]);
      setProviders(provList); setWorkflows(wfList);
      if (wfList.length > 0 && !selectedWorkflow) setSelectedWorkflow(wfList[0].id);
      setConcepts(conceptList); setJobs(jobList);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load AI Studio'); }
  }, [projectId, selectedWorkflow]);

  React.useEffect(() => { void loadAll(); }, [loadAll]);

  const activeProviderCfg = providers.find((p) => p.providerType === selectedProvider);
  const comparisonConcepts = concepts.slice(0, 4);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" />Hybrid AI Studio & Concept Generator</CardTitle><CardDescription>Generate 4 distinct brand concepts from Brand DNA while keeping original logos untouched.</CardDescription></div>
          <Button onClick={async () => { setGenerating(true); setError(null); setStatusMessage(null); try { const res = await api.generateConcepts(projectId, { provider: selectedProvider, workflowId: selectedWorkflow || undefined, parameters: { steps: Number(steps), cfg: Number(cfg) } }); setStatusMessage(`Generated 4 Brand Concepts (Job ${res.job.status}).`); await loadAll(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setGenerating(false); } }} disabled={generating}><Sparkles className="h-4 w-4" />{generating ? 'Generating...' : 'Generate 4 Brand Concepts'}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><Label>AI Provider</Label><select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm"><option value="heuristic">Built-in Local Concept Engine</option><option value="comfyui">Local ComfyUI</option><option value="local-ollama">Local Ollama</option><option value="cloud-openai">Cloud OpenAI</option><option value="cloud-gemini">Cloud Gemini</option></select></div>
            <div className="space-y-1.5"><Label>ComfyUI Workflow</Label><select value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm">{workflows.map((wf) => <option key={wf.id} value={wf.id}>{wf.name} (v{wf.version})</option>)}</select></div>
            <div className="space-y-1.5"><Label>Steps / CFG</Label><div className="flex gap-2"><Input value={steps} onChange={(e) => setSteps(e.target.value)} /><Input value={cfg} onChange={(e) => setCfg(e.target.value)} /></div></div>
            <div className="flex items-end"><Button type="button" variant="outline" className="w-full" disabled={testingProvider} onClick={async () => { if (selectedProvider === 'heuristic') { setStatusMessage('Built-in Local Engine ready.'); return; } setTestingProvider(true); try { const r = await api.testAiProvider(selectedProvider); setStatusMessage(`${r.providerType}: ${r.message} (${r.latencyMs}ms)`); await loadAll(); } finally { setTestingProvider(false); } }}><Activity className="h-4 w-4" />{testingProvider ? 'Testing...' : 'Test Connection'}</Button></div>
          </div>
          {activeProviderCfg && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mode: {activeProviderCfg.mode}</span><Badge variant={activeProviderCfg.healthStatus === 'HEALTHY' ? 'success' : 'secondary'}>{activeProviderCfg.healthStatus}</Badge></div>}
          {statusMessage && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{statusMessage}</div>}
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>

      {comparisonConcepts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {comparisonConcepts.map((concept) => {
            const previews = safeParse<Array<{ storagePath: string }>>(concept.mockupPreviewsJson, []);
            const palette = safeParse<string[]>(concept.colorPaletteJson, []);
            const primaryPreview = previews[0]?.storagePath ? getConceptAssetUrl(previews[0].storagePath) : '';
            return (
              <Card key={concept.id} className={`flex flex-col justify-between ${concept.isPrimary ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : ''}`}>
                <div>
                  <CardHeader className="pb-3"><div className="flex items-start justify-between"><div><CardTitle className="text-base">{concept.conceptName}</CardTitle><p className="text-xs text-muted-foreground">v{concept.currentVersion}</p></div><div className="flex items-center gap-1">{concept.isLocked && <Lock className="h-4 w-4 text-emerald-400" />}<button type="button" onClick={async () => { const u = await api.toggleFavoriteConcept(projectId, concept.id); setConcepts((p) => p.map((c) => (c.id === u.id ? u : c))); }}><Heart className={`h-4 w-4 ${concept.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} /></button></div></div></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative overflow-hidden rounded-md border bg-background">{primaryPreview && <img src={primaryPreview} alt={concept.conceptName} className="h-36 w-full object-cover" />}<button type="button" onClick={() => setPreviewConcept(concept)} className="absolute right-2 top-2 rounded bg-black/70 p-1.5 text-white"><Maximize2 className="h-3.5 w-3.5" /></button></div>
                    <p className="line-clamp-3 text-xs text-muted-foreground">{concept.description}</p>
                    <div className="flex gap-1">{palette.slice(0, 5).map((hex, i) => <div key={i} className="h-4 flex-1 rounded border" style={{ backgroundColor: hex }} />)}</div>
                  </CardContent>
                </div>
                <div className="flex gap-2 border-t p-4">
                  <Button size="sm" variant="outline" className="flex-1" disabled={concept.isLocked} onClick={async () => { const u = await api.regenerateConcept(projectId, concept.id, { provider: selectedProvider }); setConcepts((p) => p.map((c) => (c.id === u.id ? u : c))); }}><RefreshCw className="h-3.5 w-3.5" />Regenerate</Button>
                  <Button size="sm" className="flex-1" disabled={concept.isApproved} onClick={async () => { await api.approveConcept(projectId, concept.id); await loadAll(); }}><CheckCircle2 className="h-3.5 w-3.5" />{concept.isApproved ? 'Approved' : 'Approve'}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">AI Generation History ({jobs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{jobs.slice(0, 5).map((j) => <div key={j.id} className="flex items-center justify-between rounded border bg-background/50 px-3 py-2 text-xs"><span className="truncate">{j.jobType} · {j.provider}</span><Badge variant={j.status === 'COMPLETED' ? 'success' : 'secondary'}>{j.status}</Badge></div>)}</CardContent>
        </Card>
      )}

      <Dialog open={Boolean(previewConcept)} onOpenChange={(o) => { if (!o) setPreviewConcept(null); }} title={previewConcept?.conceptName || 'Concept Preview'}>
        {previewConcept && <p className="text-xs text-muted-foreground">{previewConcept.logoApplicationDirection}</p>}
      </Dialog>
    </div>
  );
}
