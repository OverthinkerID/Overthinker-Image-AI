'use client';
import * as React from 'react';
import { FolderPlus, Layers, Search } from 'lucide-react';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, type Project } from '@/lib/api';

export default function DashboardPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);

  const loadProjects = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setProjects(await api.listProjects({ search, status: statusFilter })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load projects'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const t = setTimeout(() => { void loadProjects(); }, 150);
    return () => clearTimeout(t);
  }, [loadProjects]);

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete "${project.name}" and its local logo storage?`)) return;
    try { await api.deleteProject(project.id); setProjects((prev) => prev.filter((p) => p.id !== project.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete project'); }
  }

  const totalLogos = projects.reduce((acc, p) => acc + p.logos.length, 0);
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Identity Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage brand projects and preserve immutable original logos locally.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><FolderPlus className="h-4 w-4" />New Project</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Total Projects</p><p className="mt-1 text-2xl font-semibold">{projects.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Active Brands</p><p className="mt-1 text-2xl font-semibold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Original Logos Vaulted</p><p className="mt-1 text-2xl font-semibold">{totalLogos}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search projects..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm">
          <option value="ALL">All Statuses</option><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-lg border bg-card/60" />)}</div> : projects.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-14 text-center"><Layers className="mb-3 h-10 w-10 text-muted-foreground opacity-60" /><h2 className="text-base font-semibold">No brand projects yet</h2><Button className="mt-5" onClick={() => setCreateOpen(true)}><FolderPlus className="h-4 w-4" />Create First Project</Button></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} project={p} onEdit={(proj) => setEditingProject(proj)} onDelete={handleDelete} />)}</div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(c) => setProjects((prev) => [c, ...prev])} />
      <EditProjectDialog project={editingProject} open={Boolean(editingProject)} onOpenChange={(o) => { if (!o) setEditingProject(null); }} onUpdated={(u) => setProjects((prev) => prev.map((p) => (p.id === u.id ? u : p)))} />
    </div>
  );
}
