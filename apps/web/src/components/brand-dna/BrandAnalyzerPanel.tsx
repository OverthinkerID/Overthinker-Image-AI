'use client';
import * as React from 'react';
import { CheckCircle2, Palette, Save, Sparkles, Type, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, getLogoFileUrl, type BrandColor, type BrandDna, type LogoAsset } from '@/lib/api';

function safeParseArray(jsonStr: string | undefined | null): string[] {
  if (!jsonStr) return [];
  try { const p = JSON.parse(jsonStr); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
}

export function BrandAnalyzerPanel({ projectId, logos }: { projectId: string; logos: LogoAsset[] }) {
  const [versions, setVersions] = React.useState<BrandDna[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<string>('heuristic');
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [brandName, setBrandName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [visualDirection, setVisualDirection] = React.useState('');
  const [colors, setColors] = React.useState<BrandColor[]>([]);
  const [headingFont, setHeadingFont] = React.useState('');
  const [bodyFont, setBodyFont] = React.useState('');
  const [visualStyle, setVisualStyle] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [brandPositioning, setBrandPositioning] = React.useState('');
  const [brandTone, setBrandTone] = React.useState('');
  const [traitsText, setTraitsText] = React.useState('');

  const activeDna = versions.find((v) => v.id === selectedId) || versions[0] || null;
  const primaryLogo = logos.find((l) => l.isPrimary) || logos[0] || null;

  const hydrateEditor = React.useCallback((dna: BrandDna | null) => {
    if (!dna) return;
    setBrandName(dna.brandName); setIndustry(dna.industry || ''); setVisualDirection(dna.visualDirection || '');
    setColors(dna.colors || []); setHeadingFont(dna.typography?.headingFont || ''); setBodyFont(dna.typography?.bodyFont || '');
    setVisualStyle(dna.personality?.visualStyle || ''); setTargetAudience(dna.personality?.targetAudience || '');
    setBrandPositioning(dna.personality?.brandPositioning || ''); setBrandTone(dna.personality?.brandTone || '');
    setTraitsText(safeParseArray(dna.personality?.personalityTraitsJson).join(', '));
  }, []);

  const loadBrandDna = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBrandDnaVersions(projectId);
      setVersions(data.versions);
      if (data.versions.length > 0) { setSelectedId((prev) => prev || data.versions[0].id); hydrateEditor(data.versions[0]); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load Brand DNA'); } finally { setLoading(false); }
  }, [projectId, hydrateEditor]);

  React.useEffect(() => { void loadBrandDna(); }, [loadBrandDna]);
  React.useEffect(() => { if (activeDna) hydrateEditor(activeDna); }, [activeDna?.id, hydrateEditor]);

  async function handleRunAnalysis() {
    setError(null); setMessage(null); setAnalyzing(true);
    try {
      const res = await api.analyzeLogo(projectId, { logoId: primaryLogo?.id, provider });
      setVersions((prev) => [res.brandDna, ...prev]); setSelectedId(res.brandDna.id); hydrateEditor(res.brandDna);
      setMessage(`Generated Brand DNA v${res.brandDna.version} from ${res.analysis.format} logo.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Logo analysis failed'); } finally { setAnalyzing(false); }
  }

  async function handleSaveEdits() {
    if (!activeDna) return;
    setError(null); setMessage(null); setSaving(true);
    try {
      const updated = await api.updateBrandDna(projectId, activeDna.id, {
        brandName, industry: industry || null, visualDirection: visualDirection || null,
        colors: colors.map((c) => ({ id: c.id, role: c.role, name: c.name || undefined, hex: c.hex })),
        typography: { headingFont, bodyFont },
        personality: { visualStyle, targetAudience, industry: industry || 'General', brandPositioning, brandTone, personalityTraits: traitsText.split(',').map((t) => t.trim()).filter(Boolean) },
      });
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setMessage(`Saved edits to Brand DNA v${updated.version}.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save Brand DNA'); } finally { setSaving(false); }
  }

  async function handleApprove() {
    if (!activeDna) return;
    setError(null); setMessage(null); setSaving(true);
    try {
      const approved = await api.approveBrandDna(projectId, activeDna.id);
      await loadBrandDna(); setSelectedId(approved.id);
      setMessage(`Brand DNA v${approved.version} approved.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to approve Brand DNA'); } finally { setSaving(false); }
  }

  const analysis = activeDna?.analysis;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />Brand DNA Engine & Logo Analyzer</CardTitle><CardDescription>Analyze primary original logo to extract colors, typography cues, and editable Brand DNA.</CardDescription></div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 rounded-md border border-input bg-background/60 px-3 text-xs">
              <option value="heuristic">Local Heuristic Engine</option><option value="local-ollama">Local Ollama</option><option value="local-openai">Local OpenAI-Compatible</option><option value="cloud-openai">Cloud OpenAI</option><option value="cloud-gemini">Cloud Gemini</option>
            </select>
            <Button onClick={handleRunAnalysis} disabled={analyzing || logos.length === 0}><Sparkles className="h-4 w-4" />{analyzing ? 'Analyzing...' : 'Analyze & Build Brand DNA'}</Button>
          </div>
        </CardHeader>
        {(message || error) && <CardContent className="pt-0">{message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</div>}{error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}</CardContent>}
      </Card>
      {loading ? <div className="h-40 animate-pulse rounded-lg border bg-card/60" /> : !activeDna ? null : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              {versions.map((v) => <Button key={v.id} size="sm" variant={v.id === activeDna.id ? 'default' : 'outline'} onClick={() => setSelectedId(v.id)}>v{v.version}{v.isApproved && <CheckCircle2 className="ml-1 h-3.5 w-3.5 text-emerald-300" />}</Button>)}
              <Badge variant={activeDna.status === 'APPROVED' ? 'success' : 'warning'}>{activeDna.status}</Badge>
            </div>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={handleSaveEdits} disabled={saving}><Save className="h-3.5 w-3.5" />Save Draft</Button><Button size="sm" onClick={handleApprove} disabled={saving || activeDna.isApproved}><CheckCircle2 className="h-3.5 w-3.5" />{activeDna.isApproved ? 'Approved' : 'Approve Brand DNA'}</Button></div>
          </div>
          {analysis && (
            <Card><CardContent className="grid gap-4 pt-5 md:grid-cols-4">
              <div className="flex h-28 items-center justify-center rounded-md border bg-background/60 p-2">{primaryLogo && <img src={getLogoFileUrl(primaryLogo.id)} alt="Logo" className="max-h-full max-w-full object-contain" />}</div>
              <div className="text-sm"><p className="text-xs text-muted-foreground">Dimensions</p><p className="font-medium">{analysis.format} · {analysis.width}×{analysis.height}</p><p className="text-xs text-muted-foreground">{analysis.aspectRatio} ({analysis.aspectLabel})</p></div>
              <div className="text-sm"><p className="text-xs text-muted-foreground">Transparency & BG</p><p className="font-medium">{analysis.hasTransparency ? 'Transparent' : 'Opaque'}</p><p className="text-xs text-muted-foreground">{analysis.backgroundType}</p></div>
              <div className="text-sm"><p className="text-xs text-muted-foreground">Style</p><p className="font-medium">{analysis.shapeStyle}</p><p className="text-xs text-muted-foreground">{analysis.isMonochrome ? 'Monochrome' : `Multicolor (${analysis.colorCount})`}</p></div>
            </CardContent></Card>
          )}
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" />Editable Brand Color Palette</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{colors.map((c, idx) => (
              <div key={c.id} className="space-y-2 rounded-md border bg-background/50 p-3">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold">{c.role}</span><input type="color" value={c.hex} onChange={(e) => setColors((prev) => prev.map((it, i) => (i === idx ? { ...it, hex: e.target.value.toUpperCase() } : it)))} className="h-7 w-9 rounded border bg-transparent" /></div>
                <Input value={c.hex} onChange={(e) => setColors((prev) => prev.map((it, i) => (i === idx ? { ...it, hex: e.target.value.toUpperCase() } : it)))} className="h-8 font-mono text-xs" />
              </div>
            ))}</CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Type className="h-4 w-4 text-primary" />Typography System</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {activeDna.typography && <p className="rounded border bg-background/50 p-2.5 text-xs text-muted-foreground">{activeDna.typography.confidenceNote}</p>}
                <div className="grid gap-3 sm:grid-cols-2"><div><Label>Heading Font</Label><Input value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} /></div><div><Label>Body Font</Label><Input value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} /></div></div>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Brand Personality</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2"><div><Label>Brand Name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></div><div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div></div>
                <div><Label>Traits</Label><Input value={traitsText} onChange={(e) => setTraitsText(e.target.value)} /></div>
                <div><Label>Positioning</Label><Textarea value={brandPositioning} onChange={(e) => setBrandPositioning(e.target.value)} /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
