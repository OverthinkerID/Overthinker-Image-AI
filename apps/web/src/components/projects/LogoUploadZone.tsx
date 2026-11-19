'use client';
import * as React from 'react';
import { ShieldCheck, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type LogoAsset } from '@/lib/api';

export function LogoUploadZone({ projectId, onUploaded }: { projectId: string; onUploaded: (l: LogoAsset) => void }) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function processFile(file: File) {
    setError(null); setUploading(true);
    try { onUploaded(await api.uploadLogo(projectId, file, true)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Logo upload failed'); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) void processFile(e.dataTransfer.files[0]); }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-background/40'}`}
      >
        <UploadCloud className="mb-3 h-9 w-9 text-primary" />
        <p className="text-sm font-medium">Drag and drop your original logo here, or browse from disk</p>
        <p className="mt-1 text-xs text-muted-foreground">Supports PNG, SVG, WebP, JPEG up to 15 MB</p>
        <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void processFile(e.target.files[0]); e.target.value = ''; }} />
        <Button type="button" variant="secondary" size="sm" className="mt-4" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? 'Uploading Original...' : 'Select Logo File'}</Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-400" /><span>Originals are stored in an immutable local vault and are never overwritten.</span></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
