'use client';
import * as React from 'react';
import { Copy, Download, FolderArchive, LayoutTemplate, Palette, PenTool, Shapes, Sparkles, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_BASE, api, getBrandAssetFileUrl, type BrandAsset, type ColorSystem, type DesignDocument, type DesignTemplate, type GraphicElement, type LogoVariation, type TypographySystem } from '@/lib/api';
import { FabricCanvasEditor } from './FabricCanvasEditor';

type StudioTab = 'STUDIO' | 'LOGOS' | 'COLORS' | 'TYPOGRAPHY' | 'ELEMENTS' | 'TEMPLATES' | 'LIBRARY' | 'EXPORTS';
const NAV_TABS: Array<{ key: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'STUDIO', label: 'Design Studio', icon: PenTool }, { key: 'LOGOS', label: 'Logo System', icon: Sparkles },
  { key: 'COLORS', label: 'Colors', icon: Palette }, { key: 'TYPOGRAPHY', label: 'Typography', icon: Type },
  { key: 'ELEMENTS', label: 'Icons & Patterns', icon: Shapes }, { key: 'TEMPLATES', label: 'Templates', icon: LayoutTemplate },
  { key: 'LIBRARY', label: 'Asset Library', icon: FolderArchive }, { key: 'EXPORTS', label: 'Export Center', icon: Download },
];

export function DesignStudioWorkspace({ projectId }: { projectId: string }) {
  const [tab, setTab] = React.useState<StudioTab>('STUDIO');
  const [variations, setVariations] = React.useState<LogoVariation[]>([]);
  const [colorSystems, setColorSystems] = React.useState<ColorSystem[]>([]);
  const [typoSystems, setTypoSystems] = React.useState<TypographySystem[]>([]);
  const [elements, setElements] = React.useState<GraphicElement[]>([]);
  const [templates, setTemplates] = React.useState<DesignTemplate[]>([]);
  const [documents, setDocuments] = React.useState<DesignDocument[]>([]);
  const [activeDoc, setActiveDoc] = React.useState<DesignDocument | null>(null);
  const [assets, setAssets] = React.useState<BrandAsset[]>([]);
  const [assetSearch, setAssetSearch] = React.useState('');
  const [exportFormat, setExportFormat] = React.useState<'PNG' | 'SVG' | 'WEBP' | 'PDF' | 'JSON'>('PNG');
  const [exportTransparent, setExportTransparent] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    const [vars, cols, typos, elems, tpls, docs, lib] = await Promise.all([
      api.listLogoVariations(projectId), api.listColorSystems(projectId), api.listTypographySystems(projectId),
      api.listGraphicElements(projectId), api.listTemplates(projectId), api.listDocuments(projectId),
      api.listAssets(projectId, { search: assetSearch }),
    ]);
    setVariations(vars); setColorSystems(cols); setTypoSystems(typos); setElements(elems);
    setTemplates(tpls); setDocuments(docs);
    setActiveDoc((prev) => (prev ? docs.find((d) => d.id === prev.id) || docs[0] || null : docs[0] || null));
    setAssets(lib);
  }, [projectId, assetSearch]);

  React.useEffect(() => { void loadAll(); }, [loadAll]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card p-2">
        {NAV_TABS.map(({ key, label, icon: Icon }) => <Button key={key} size="sm" variant={tab === key ? 'default' : 'ghost'} onClick={() => setTab(key)}><Icon className="h-3.5 w-3.5" />{label}</Button>)}
      </div>
      {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</div>}

      {tab === 'STUDIO' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">{documents.map((d) => <Button key={d.id} size="sm" variant={activeDoc?.id === d.id ? 'secondary' : 'outline'} onClick={() => setActiveDoc(d)}>{d.title} (v{d.currentVersion})</Button>)}</div>
            <Button size="sm" variant="outline" onClick={() => setTab('TEMPLATES')}>+ New from Template</Button>
          </div>
          {activeDoc ? <FabricCanvasEditor document={activeDoc} onSaveVersion={async (cj, cn) => { const u = await api.saveDocumentVersion(projectId, activeDoc.id, { canvasJson: cj, changeNote: cn }); setActiveDoc(u); setMessage(`Saved ${u.title} v${u.currentVersion}.`); await loadAll(); }} onRestoreVersion={async (ver) => { const r = await api.restoreDocumentVersion(projectId, activeDoc.id, ver); setActiveDoc(r); setMessage(`Restored v${ver}.`); await loadAll(); }} /> : <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a template from the Templates tab to launch Fabric.js.</CardContent></Card>}
        </div>
      )}

      {tab === 'LOGOS' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Logo Variation System ({variations.length})</CardTitle><CardDescription>10 structured variations preserving original master logo.</CardDescription></div><Button onClick={async () => { await api.generateLogoVariations(projectId); setMessage('Generated 10-logo variation system.'); await loadAll(); }}>Generate 10 Variations</Button></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{variations.map((v) => <div key={v.id} className="space-y-2 rounded border bg-background/50 p-3 text-xs"><div className="flex h-24 items-center justify-center rounded border bg-white/95 p-2">{v.svgContent ? <div className="max-h-full max-w-full" dangerouslySetInnerHTML={{ __html: v.svgContent }} /> : <span className="text-zinc-600">{v.format}</span>}</div><p className="font-semibold">{v.variationType}</p><p className="text-muted-foreground">{v.format} · v{v.version}</p></div>)}</CardContent>
        </Card>
      )}

      {tab === 'COLORS' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Color System & WCAG Accessibility</CardTitle><CardDescription>HEX, RGB, HSL, CMYK and AA/AAA contrast checks.</CardDescription></div><Button onClick={async () => { await api.generateColorSystem(projectId); setMessage('Generated Brand Color System.'); await loadAll(); }}>Generate Color System</Button></CardHeader>
          <CardContent className="space-y-4">{colorSystems[0] && <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(JSON.parse(colorSystems[0].palettesJson) as Record<string, Array<{ name: string; hex: string; cmyk: string }>>).map(([group, list]) => list.map((c, idx) => <div key={`${group}-${idx}`} className="space-y-1.5 rounded border p-2.5 text-xs"><div className="h-12 rounded border" style={{ backgroundColor: c.hex }} /><p className="font-semibold uppercase">{group}</p><p className="font-mono">{c.hex}</p><p className="text-[11px] text-muted-foreground">{c.cmyk}</p></div>))}</div>}</CardContent>
        </Card>
      )}

      {tab === 'TYPOGRAPHY' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Typography System</CardTitle><CardDescription>Display, Heading, Subheading, Body, Caption hierarchy.</CardDescription></div><Button onClick={async () => { await api.generateTypographySystem(projectId); setMessage('Generated Typography System.'); await loadAll(); }}>Generate Typography System</Button></CardHeader>
          <CardContent className="space-y-3">{typoSystems[0] && Object.values(JSON.parse(typoSystems[0].rolesJson) as Record<string, { role: string; fontFamily: string; fontSizePx: number; fontWeight: number; lineHeight: number; license: string }>).map((r) => <div key={r.role} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/50 p-3 text-xs"><div><p className="font-semibold uppercase">{r.role}</p><p className="text-muted-foreground">{r.fontFamily} · {r.fontSizePx}px · Weight {r.fontWeight} · LH {r.lineHeight}</p></div><Badge variant="outline">{r.license}</Badge></div>)}</CardContent>
        </Card>
      )}

      {tab === 'ELEMENTS' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Iconography & Graphic Elements ({elements.length})</CardTitle></div><Button onClick={async () => { await api.generateGraphicElements(projectId, 'SVG'); setMessage('Generated Graphic Elements.'); await loadAll(); }}>Generate Graphic Set</Button></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{elements.map((el) => <div key={el.id} className="space-y-2 rounded border bg-background/50 p-3 text-xs"><div className="flex h-24 items-center justify-center rounded border bg-white/95 p-2">{el.svgContent ? <div className="max-h-full max-w-full" dangerouslySetInnerHTML={{ __html: el.svgContent }} /> : <span>{el.format}</span>}</div><p className="font-semibold">{el.elementType}</p></div>)}</CardContent>
        </Card>
      )}

      {tab === 'TEMPLATES' && (
        <Card>
          <CardHeader><CardTitle>Brand Template Engine ({templates.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{templates.map((tpl) => <div key={tpl.id} className="flex flex-col justify-between rounded border bg-background/50 p-3 text-xs"><div className="space-y-1"><Badge variant="secondary">{tpl.category}</Badge><p className="pt-1 text-sm font-semibold">{tpl.name}</p><p className="text-muted-foreground">{tpl.width} × {tpl.height} px</p></div><Button size="sm" className="mt-3" onClick={async () => { const doc = await api.instantiateTemplate(projectId, tpl.id); setActiveDoc(doc); setTab('STUDIO'); await loadAll(); }}>Open in Editor</Button></div>)}</CardContent>
        </Card>
      )}

      {tab === 'LIBRARY' && (
        <Card>
          <CardHeader><CardTitle>Brand Asset Library ({assets.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Search generated assets..." value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{assets.map((a) => <div key={a.id} className="flex flex-col justify-between rounded border bg-background/50 p-3 text-xs"><div className="space-y-1"><Badge variant="outline">{a.category}</Badge><p className="truncate pt-1 font-semibold">{a.name}</p><p className="text-muted-foreground">{a.assetType} · v{a.version}</p></div><div className="mt-3 flex gap-1.5"><a href={getBrandAssetFileUrl(projectId, a.id)} download className="inline-flex h-8 flex-1 items-center justify-center rounded border px-2 hover:bg-accent"><Download className="h-3.5 w-3.5" /></a><Button size="sm" variant="outline" onClick={async () => { await api.duplicateAsset(projectId, a.id); await loadAll(); }}><Copy className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!window.confirm(`Delete "${a.name}"?`)) return; await api.deleteAsset(projectId, a.id); await loadAll(); }}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div>
          </CardContent>
        </Card>
      )}

      {tab === 'EXPORTS' && (
        <Card>
          <CardHeader><CardTitle>Export Center</CardTitle><CardDescription>PNG, SVG, WebP, PDF, JSON, and ZIP package exports.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)} className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm"><option value="PNG">PNG</option><option value="SVG">SVG</option><option value="WEBP">WebP</option><option value="PDF">PDF</option><option value="JSON">JSON</option></select>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={exportTransparent} onChange={(e) => setExportTransparent(e.target.checked)} />Transparent Background</label>
              <Button variant="secondary" onClick={async () => { const r = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/export/package`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!r.ok) return; const b = await r.blob(); const u = URL.createObjectURL(b); const a = window.document.createElement('a'); a.href = u; a.download = 'brand-package.zip'; a.click(); URL.revokeObjectURL(u); }}><FolderArchive className="h-4 w-4" />Export Complete Brand ZIP</Button>
            </div>
            <div className="space-y-2">{documents.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded border bg-background/50 px-3 py-2 text-xs"><span>{doc.title} ({doc.width}×{doc.height})</span><Button size="sm" onClick={async () => { const r = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(doc.id)}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: exportFormat, transparent: exportTransparent }) }); if (!r.ok) return; const b = await r.blob(); const u = URL.createObjectURL(b); const a = window.document.createElement('a'); a.href = u; a.download = `design.${exportFormat.toLowerCase()}`; a.click(); URL.revokeObjectURL(u); }}><Download className="h-3.5 w-3.5" />Export {exportFormat}</Button></div>)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
