'use client';
import * as React from 'react';
import * as fabric from 'fabric';
import { AlignCenter, AlignLeft, AlignRight, Circle as CircleIcon, Copy, Layers, Redo2, Save, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DesignDocument } from '@/lib/api';

export function FabricCanvasEditor({ document: designDoc, onSaveVersion, onRestoreVersion }: { document: DesignDocument; onSaveVersion: (c: string, n: string) => Promise<void>; onRestoreVersion: (v: number) => Promise<void> }) {
  const canvasElRef = React.useRef<HTMLCanvasElement | null>(null);
  const fabricRef = React.useRef<fabric.Canvas | null>(null);
  const [history, setHistory] = React.useState<string[]>([designDoc.canvasJson]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const [layers, setLayers] = React.useState<Array<{ id: number; name: string; type: string }>>([]);
  const [selectedColor, setSelectedColor] = React.useState('#2563EB');
  const [selectedFont, setSelectedFont] = React.useState('Plus Jakarta Sans');
  const [changeNote, setChangeNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const syncLayers = React.useCallback((canvas: fabric.Canvas) => {
    setLayers(canvas.getObjects().map((o, idx) => ({ id: idx, name: (o as unknown as { name?: string }).name || `${o.type} #${idx + 1}`, type: o.type || 'object' })));
  }, []);

  const pushSnapshot = React.useCallback((canvas: fabric.Canvas) => {
    const json = JSON.stringify(canvas.toJSON());
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), json]);
    setHistoryIndex((i) => i + 1);
    syncLayers(canvas);
  }, [historyIndex, syncLayers]);

  React.useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, { width: Math.min(760, designDoc.width), height: Math.round((Math.min(760, designDoc.width) / designDoc.width) * designDoc.height), backgroundColor: '#FFFFFF' });
    fabricRef.current = canvas;
    void canvas.loadFromJSON(JSON.parse(designDoc.canvasJson)).then(() => { canvas.setZoom(canvas.getWidth() / designDoc.width); canvas.renderAll(); syncLayers(canvas); });
    canvas.on('object:modified', () => pushSnapshot(canvas));
    return () => { void canvas.dispose(); fabricRef.current = null; };
  }, [designDoc.id, designDoc.canvasJson, designDoc.width, designDoc.height]);

  function handleUndo() {
    if (!fabricRef.current || historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    void fabricRef.current.loadFromJSON(JSON.parse(history[nextIdx])).then(() => { fabricRef.current?.renderAll(); setHistoryIndex(nextIdx); if (fabricRef.current) syncLayers(fabricRef.current); });
  }
  function handleRedo() {
    if (!fabricRef.current || historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    void fabricRef.current.loadFromJSON(JSON.parse(history[nextIdx])).then(() => { fabricRef.current?.renderAll(); setHistoryIndex(nextIdx); if (fabricRef.current) syncLayers(fabricRef.current); });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-9">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5">
          <Button size="sm" variant="outline" onClick={handleUndo} disabled={historyIndex <= 0}><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1}><Redo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => { const c = fabricRef.current; if (!c) return; const tb = new fabric.Textbox('Editable Brand Text', { left: 90, top: 140, width: 320, fontSize: 36, fontFamily: selectedFont, fill: selectedColor }); c.add(tb); c.setActiveObject(tb); pushSnapshot(c); }}><Type className="h-3.5 w-3.5" /> Text</Button>
          <Button size="sm" variant="outline" onClick={() => { const c = fabricRef.current; if (!c) return; const r = new fabric.Rect({ left: 80, top: 80, width: 180, height: 120, fill: selectedColor, rx: 12, ry: 12 }); c.add(r); c.setActiveObject(r); pushSnapshot(c); }}><Square className="h-3.5 w-3.5" /> Rect</Button>
          <Button size="sm" variant="outline" onClick={() => { const c = fabricRef.current; if (!c) return; const cr = new fabric.Circle({ left: 120, top: 120, radius: 65, fill: selectedColor }); c.add(cr); c.setActiveObject(cr); pushSnapshot(c); }}><CircleIcon className="h-3.5 w-3.5" /> Circle</Button>
          <Button size="sm" variant="ghost" onClick={() => { const c = fabricRef.current, a = c?.getActiveObject(); if (!c || !a) return; a.set('left', 32); a.setCoords(); c.renderAll(); pushSnapshot(c); }}><AlignLeft className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const c = fabricRef.current, a = c?.getActiveObject(); if (!c || !a) return; a.set('left', (designDoc.width - (a.width || 100)) / 2); a.setCoords(); c.renderAll(); pushSnapshot(c); }}><AlignCenter className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const c = fabricRef.current, a = c?.getActiveObject(); if (!c || !a) return; a.set('left', designDoc.width - (a.width || 100) - 32); a.setCoords(); c.renderAll(); pushSnapshot(c); }}><AlignRight className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { const c = fabricRef.current, a = c?.getActiveObject(); if (!c || !a) return; const cl = await a.clone(); cl.set({ left: (a.left || 0) + 24, top: (a.top || 0) + 24 }); c.add(cl); c.setActiveObject(cl); pushSnapshot(c); }}><Copy className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { const c = fabricRef.current, a = c?.getActiveObject(); if (!c || !a) return; c.remove(a); pushSnapshot(c); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          <div className="ml-auto flex items-center gap-2">
            <input type="color" value={selectedColor} onChange={(e) => { setSelectedColor(e.target.value); const c = fabricRef.current, a = c?.getActiveObject(); if (c && a) { a.set('fill', e.target.value); c.renderAll(); pushSnapshot(c); } }} className="h-8 w-8 rounded border bg-transparent" />
            <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Version note..." className="h-8 w-36 text-xs" />
            <Button size="sm" disabled={saving} onClick={async () => { const c = fabricRef.current; if (!c) return; setSaving(true); try { await onSaveVersion(JSON.stringify(c.toJSON()), changeNote || `Manual edit v${designDoc.currentVersion + 1}`); setChangeNote(''); } finally { setSaving(false); } }}><Save className="h-3.5 w-3.5" />{saving ? 'Saving...' : `Save v${designDoc.currentVersion + 1}`}</Button>
          </div>
        </div>
        <div className="flex justify-center overflow-auto rounded-lg border bg-zinc-900/70 p-4"><canvas ref={canvasElRef} className="rounded shadow-lg" /></div>
      </div>
      <div className="space-y-4 lg:col-span-3">
        <div className="space-y-2 rounded-lg border bg-card p-3"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Layers ({layers.length})</p><div className="max-h-48 space-y-1 overflow-y-auto text-xs">{layers.map((l) => <div key={l.id} className="flex items-center justify-between rounded bg-background/60 px-2 py-1.5"><span className="truncate">{l.name}</span><span className="text-[10px] text-muted-foreground">{l.type}</span></div>)}</div></div>
        <div className="space-y-2 rounded-lg border bg-card p-3"><Label className="text-xs uppercase text-muted-foreground">Font Family</Label><Input value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} className="h-8 text-xs" /></div>
        <div className="space-y-2 rounded-lg border bg-card p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Version History</p><div className="max-h-52 space-y-1.5 overflow-y-auto text-xs">{designDoc.versions.map((v) => <div key={v.id} className="flex items-center justify-between gap-2 rounded border bg-background/50 px-2 py-1.5"><div className="min-w-0"><p className="font-medium">v{v.version}</p><p className="truncate text-[11px] text-muted-foreground">{v.changeNote || 'Saved'}</p></div><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void onRestoreVersion(v.version)}>Restore</Button></div>)}</div></div>
      </div>
    </div>
  );
}
