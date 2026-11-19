'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Cpu, Lock, Pencil, PenTool, Sparkles, Star, Trash2 } from 'lucide-react';
import { BrandAnalyzerPanel } from '@/components/brand-dna/BrandAnalyzerPanel';
import { ConceptStudioPanel } from '@/components/concepts/ConceptStudioPanel';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { LogoUploadZone } from '@/components/projects/LogoUploadZone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getLogoFileUrl, type LogoAsset, type Project } from '@/lib/api';
import { formatBytes } from '@/lib/utils';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  const loadProject = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setProject(await api.getProject(projectId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load project'); }
    finally { setLoading(false); }
  }, [projectId]);

  React.useEffect(() => { void loadProject(); }, [loadProject]);

  if (loading) return <div className="h-64 animate-pulse rounded-lg border bg-card/60" />;
  if (error || !project) return <div className="space-y-4"><Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button></Link><div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error || 'Project not found.'}</div></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Dashboard</Link>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">{project.name}</h1><Badge variant={project.status === 'ACTIVE' ? 'success' : 'secondary'}>{project.status}</Badge></div>
          <p className="text-sm text-muted-foreground">{project.industry || 'General Brand'} · Slug: <code>{project.slug}</code></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${project.id}/studio`}><Button size="sm"><PenTool className="h-3.5 w-3.5" />Design Studio</Button></Link>
          <Link href={`/projects/${project.id}/mockups`}><Button size="sm" variant="secondary"><BookOpen className="h-3.5 w-3.5" />Mockups & Guidelines</Button></Link>
          <Link href={`/projects/${project.id}/automation`}><Button size="sm" variant="outline"><Cpu className="h-3.5 w-3.5" />Automation & Export</Button></Link>
          <Link href={`/projects/${project.id}/creative-director`}><Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" />Creative Director</Button></Link>
          <Link href={`/projects/${project.id}/image-editor`}><Button size="sm" variant="outline"><PenTool className="h-3.5 w-3.5" />AI Image Editor</Button></Link>
          <Link href={`/projects/${project.id}/strategy`}><Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" />Market & Strategy</Button></Link>
          <Link href={`/projects/${project.id}/marketing`}><Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" />Marketing Studio</Button></Link>
          <Link href={`/projects/${project.id}/video`}><Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" />Video & Motion</Button></Link>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
          <Button variant="destructive" size="sm" onClick={async () => { if (!window.confirm(`Delete "${project.name}"?`)) return; await api.deleteProject(project.id); router.push('/'); }}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Upload Original Logo</CardTitle><CardDescription>Hashed (SHA-256) and stored in an immutable path.</CardDescription></CardHeader><CardContent><LogoUploadZone projectId={project.id} onUploaded={() => { void loadProject(); }} /></CardContent></Card>
        <Card className="lg:col-span-3"><CardHeader><CardTitle>Original Logo Vault ({project.logos.length})</CardTitle></CardHeader>
          <CardContent>
            {project.logos.length === 0 ? <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">No original logos uploaded yet.</div> : (
              <div className="grid gap-4 sm:grid-cols-2">{project.logos.map((logo: LogoAsset) => (
                <div key={logo.id} className="flex flex-col justify-between rounded-lg border bg-background/50 p-3">
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded border bg-background p-3"><img src={getLogoFileUrl(logo.id)} alt={logo.originalFilename} className="max-h-full max-w-full object-contain" /></div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{logo.originalFilename}</p>{logo.isPrimary && <Badge variant="success" className="shrink-0 gap-1"><CheckCircle2 className="h-3 w-3" />Primary</Badge>}</div>
                    <p className="text-xs text-muted-foreground">{logo.mimeType} · {formatBytes(logo.fileSize)}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Lock className="h-3 w-3 shrink-0 text-emerald-400" /><span className="truncate">SHA-256: {logo.sha256.slice(0, 16)}…</span></div>
                    {!logo.isPrimary && <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={async () => { await api.setPrimaryLogo(project.id, logo.id); await loadProject(); }}><Star className="h-3.5 w-3.5" />Set as Primary</Button>}
                  </div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <BrandAnalyzerPanel projectId={project.id} logos={project.logos} />
      <ConceptStudioPanel projectId={project.id} />
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onUpdated={(u) => setProject(u)} />
    </div>
  );
}
