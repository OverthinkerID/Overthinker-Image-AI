'use client';
import * as React from 'react';
import { BookOpen, Box, Download, Heart, Image as ImageIcon, Layers, Presentation, Save, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE, api, getMockupRenderUrl, type BrandGuideline, type BrandPresentation, type MockupDocument, type MockupRenderJob, type MockupTemplate } from '@/lib/api';

type Phase5Tab = 'MOCKUP_STUDIO' | 'MOCKUP_LIBRARY' | 'AI_MOCKUP' | 'GUIDELINES' | 'PRESENTATION' | 'EXPORT_CENTER';
const TABS: Array<{ key: Phase5Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'MOCKUP_STUDIO', label: 'Mockup Studio', icon: Layers }, { key: 'MOCKUP_LIBRARY', label: 'Mockup Library', icon: Box },
  { key: 'AI_MOCKUP', label: 'AI Mockup Generator', icon: Sparkles }, { key: 'GUIDELINES', label: 'Brand Guidelines', icon: BookOpen },
  { key: 'PRESENTATION', label: 'Presentation Studio', icon: Presentation }, { key: 'EXPORT_CENTER', label: 'Export Center', icon: Download },
];

async function downloadBlob(url: string, body: unknown, filename: string) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) return;
  const blob = await res.blob(), objUrl = URL.createObjectURL(blob), a = window.document.createElement('a');
  a.href = objUrl; a.download = filename; a.click(); URL.revokeObjectURL(objUrl);
}

export function MockupGuidelinesWorkspace({ projectId }: { projectId: string }) {
  const [tab, setTab] = React.useState<Phase5Tab>('MOCKUP_LIBRARY');
  const [templates, setTemplates] = React.useState<MockupTemplate[]>([]);
  const [catFilter, setCatFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [mockups, setMockups] = React.useState<MockupDocument[]>([]);
  const [activeMockup, setActiveMockup] = React.useState<MockupDocument | null>(null);
  const [sceneDraft, setSceneDraft] = React.useState({ logoX: 500, logoY: 340, logoScale: 1, logoRotation: 0, objectColor: '#1E293B', backgroundColor: '#0F172A', headlineText: '', subtext: '' });
  const [aiJobs, setAiJobs] = React.useState<MockupRenderJob[]>([]);
  const [aiProvider, setAiProvider] = React.useState('heuristic');
  const [aiCategory, setAiCategory] = React.useState('PACKAGING');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [guidelines, setGuidelines] = React.useState<BrandGuideline[]>([]);
  const [presentations, setPresentations] = React.useState<BrandPresentation[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    const [tpls, mks, jobs, gds, prs] = await Promise.all([
      api.listMockupTemplates(projectId, { category: catFilter, search }), api.listMockups(projectId),
      api.listAiMockupJobs(projectId), api.listGuidelines(projectId), api.listPresentations(projectId),
    ]);
    setTemplates(tpls); setMockups(mks);
    setActiveMockup((prev) => (prev ? mks.find((m) => m.id === prev.id) || mks[0] || null : mks[0] || null));
    setAiJobs(jobs); setGuidelines(gds); setPresentations(prs);
  }, [projectId, catFilter, search]);

  React.useEffect(() => { void loadAll(); }, [loadAll]);
  React.useEffect(() => { if (activeMockup) setSceneDraft((prev) => ({ ...prev, ...JSON.parse(activeMockup.sceneConfigJson || '{}') })); }, [activeMockup?.id]);

  const activeGuideline = guidelines[0] || null;
  const activePres = presentations[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card p-2">
        {TABS.map(({ key, label, icon: Icon }) => <Button key={key} size="sm" variant={tab === key ? 'default' : 'ghost'} onClick={() => setTab(key)}><Icon className="h-3.5 w-3.5" />{label}</Button>)}
      </div>
      {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</div>}

      {tab === 'MOCKUP_STUDIO' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-8"><CardHeader><CardTitle>{activeMockup ? `${activeMockup.title} (v${activeMockup.currentVersion})` : 'Mockup Preview'}</CardTitle></CardHeader>
            <CardContent>{activeMockup ? <img src={getMockupRenderUrl(projectId, activeMockup.id, activeMockup.currentVersion)} alt={activeMockup.title} className="w-full rounded-lg border" /> : <div className="py-16 text-center text-sm text-muted-foreground">Select a mockup template from Mockup Library first.</div>}</CardContent>
          </Card>
          <Card className="lg:col-span-4"><CardHeader><CardTitle className="text-base">Scene Controls</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Logo X</Label><Input type="number" value={sceneDraft.logoX} onChange={(e) => setSceneDraft({ ...sceneDraft, logoX: Number(e.target.value) })} /></div>
                <div><Label>Logo Y</Label><Input type="number" value={sceneDraft.logoY} onChange={(e) => setSceneDraft({ ...sceneDraft, logoY: Number(e.target.value) })} /></div>
                <div><Label>Scale</Label><Input type="number" step="0.1" value={sceneDraft.logoScale} onChange={(e) => setSceneDraft({ ...sceneDraft, logoScale: Number(e.target.value) })} /></div>
                <div><Label>Rotation</Label><Input type="number" value={sceneDraft.logoRotation} onChange={(e) => setSceneDraft({ ...sceneDraft, logoRotation: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Object Color</Label><input type="color" value={sceneDraft.objectColor} onChange={(e) => setSceneDraft({ ...sceneDraft, objectColor: e.target.value })} className="h-9 w-full rounded border bg-transparent" /></div>
                <div><Label>Background</Label><input type="color" value={sceneDraft.backgroundColor} onChange={(e) => setSceneDraft({ ...sceneDraft, backgroundColor: e.target.value })} className="h-9 w-full rounded border bg-transparent" /></div>
              </div>
              <div><Label>Headline Text</Label><Input value={sceneDraft.headlineText} onChange={(e) => setSceneDraft({ ...sceneDraft, headlineText: e.target.value })} /></div>
              <div><Label>Subtext</Label><Input value={sceneDraft.subtext} onChange={(e) => setSceneDraft({ ...sceneDraft, subtext: e.target.value })} /></div>
              <Button className="w-full" disabled={!activeMockup} onClick={async () => { if (!activeMockup) return; const u = await api.updateMockup(projectId, activeMockup.id, { scene: sceneDraft }); setActiveMockup(u); setMessage(`Saved ${u.title} v${u.currentVersion}.`); await loadAll(); }}><Save className="h-3.5 w-3.5" />Render & Save Version</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'MOCKUP_LIBRARY' && (
        <Card><CardHeader><CardTitle>Mockup Library ({templates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row"><Input placeholder="Search mockups..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm"><option value="ALL">All Categories</option><option value="STATIONERY">Stationery</option><option value="PACKAGING">Packaging</option><option value="ENVIRONMENT">Environment</option><option value="MERCHANDISE">Merchandise</option><option value="DIGITAL">Digital</option><option value="RETAIL">Retail</option></select></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{templates.map((tpl) => <div key={tpl.id} className="flex flex-col justify-between rounded border bg-background/50 p-3 text-xs"><div className="space-y-1"><div className="flex items-center justify-between"><Badge variant="secondary">{tpl.category}</Badge><button type="button" onClick={async () => { await api.toggleMockupTemplateFavorite(projectId, tpl.id); await loadAll(); }}><Heart className={`h-4 w-4 ${tpl.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} /></button></div><p className="pt-1 text-sm font-semibold">{tpl.name}</p><p className="text-muted-foreground">{tpl.description}</p></div><Button size="sm" className="mt-3" onClick={async () => { const c = await api.createMockup(projectId, { templateId: tpl.id }); setActiveMockup(c); setTab('MOCKUP_STUDIO'); await loadAll(); }}>Launch in Studio</Button></div>)}</div>
          </CardContent>
        </Card>
      )}

      {tab === 'AI_MOCKUP' && (
        <Card><CardHeader><CardTitle>AI Mockup Scene Generator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className="h-9 rounded-md border bg-background/60 px-3 text-sm"><option value="heuristic">Local Studio Engine</option><option value="comfyui">Local ComfyUI</option><option value="cloud-openai">Cloud OpenAI</option></select><select value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} className="h-9 rounded-md border bg-background/60 px-3 text-sm"><option value="PACKAGING">Packaging</option><option value="STATIONERY">Stationery</option><option value="ENVIRONMENT">Environment</option><option value="MERCHANDISE">Merchandise</option><option value="DIGITAL">Digital</option><option value="RETAIL">Retail</option></select><Button onClick={async () => { await api.generateAiMockup(projectId, { provider: aiProvider, category: aiCategory, instructions: aiPrompt }); setMessage('Generated AI Mockup.'); await loadAll(); }}><Sparkles className="h-4 w-4" />Generate AI Mockup</Button></div>
            <Textarea placeholder="Scene instructions..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
            <div className="space-y-2">{aiJobs.map((j) => <div key={j.id} className="flex items-center justify-between rounded border bg-background/50 px-3 py-2 text-xs"><span className="truncate">{j.provider} · {j.prompt}</span><Badge variant={j.status === 'COMPLETED' ? 'success' : 'secondary'}>{j.status}</Badge></div>)}</div>
          </CardContent>
        </Card>
      )}

      {tab === 'GUIDELINES' && (
        <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Brand Guidelines (20 Sections)</CardTitle></div><Button onClick={async () => { await api.generateGuidelines(projectId); setMessage('Generated 20-section Brand Guidelines.'); await loadAll(); }}>Generate Brand Guidelines</Button></CardHeader>
          <CardContent className="space-y-3">{activeGuideline?.sections.map((sec) => <div key={sec.id} className="space-y-2 rounded border bg-background/50 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{sec.title}</p>{sec.isPlaceholder && <Badge variant="warning">Needs User Input</Badge>}</div><Textarea defaultValue={sec.content} onBlur={async (e) => { if (e.target.value === sec.content) return; await api.updateGuidelineSection(projectId, activeGuideline.id, sec.id, { content: e.target.value }); await loadAll(); }} /></div>)}</CardContent>
        </Card>
      )}

      {tab === 'PRESENTATION' && (
        <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Brand Presentation Studio (16:9)</CardTitle></div><Button onClick={async () => { await api.generatePresentation(projectId); setMessage('Generated 16:9 Presentation.'); await loadAll(); }}>Generate 16:9 Presentation</Button></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">{activePres?.slides.map((s, idx) => <div key={s.id} className="space-y-2 rounded border bg-background/50 p-3 text-xs"><div className="flex items-center justify-between"><Badge variant="outline">Slide {idx + 1} · {s.slideType}</Badge><Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await api.deletePresentationSlide(projectId, activePres.id, s.id); await loadAll(); }}><Trash2 className="h-3.5 w-3.5" /></Button></div><Input defaultValue={s.title} onBlur={async (e) => { if (e.target.value !== s.title) { await api.updatePresentationSlide(projectId, activePres.id, s.id, { title: e.target.value }); await loadAll(); } }} /><Textarea defaultValue={s.body} onBlur={async (e) => { if (e.target.value !== s.body) { await api.updatePresentationSlide(projectId, activePres.id, s.id, { body: e.target.value }); await loadAll(); } }} /></div>)}</CardContent>
        </Card>
      )}

      {tab === 'EXPORT_CENTER' && (
        <Card><CardHeader><CardTitle>Document & Mockup Export Center</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {activeGuideline && <Button variant="outline" onClick={() => void downloadBlob(`${API_BASE}/projects/${projectId}/guidelines/${activeGuideline.id}/export/pdf`, {}, `${activeGuideline.title}.pdf`)}><Download className="mr-2 h-4 w-4" />Export Brand Guidelines PDF</Button>}
            {activePres && <Button variant="outline" className="ml-2" onClick={() => void downloadBlob(`${API_BASE}/projects/${projectId}/presentations/${activePres.id}/export/pdf`, {}, `${activePres.title}.pdf`)}><Download className="mr-2 h-4 w-4" />Export 16:9 Presentation PDF</Button>}
            <div className="pt-2"><Button variant="secondary" onClick={() => void downloadBlob(`${API_BASE}/projects/${projectId}/mockups/export/zip`, {}, 'mockups-package.zip')}><ImageIcon className="mr-2 h-4 w-4" />Export Complete Mockups ZIP</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
