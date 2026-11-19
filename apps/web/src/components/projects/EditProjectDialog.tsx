'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, type Project, type ProjectStatus } from '@/lib/api';

export function EditProjectDialog({ project, open, onOpenChange, onUpdated }: { project: Project | null; open: boolean; onOpenChange: (o: boolean) => void; onUpdated: (p: Project) => void }) {
  const [name, setName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<ProjectStatus>('DRAFT');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (project) { setName(project.name); setIndustry(project.industry || ''); setDescription(project.description || ''); setStatus(project.status); setError(null); }
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!project) return;
    setError(null); setSubmitting(true);
    try {
      const updated = await api.updateProject(project.id, { name, industry: industry.trim() || null, description: description.trim() || null, status });
      onUpdated(updated); onOpenChange(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update project'); } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit Brand Project" description="Update project metadata and lifecycle status.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="edit-name">Project Name *</Label><Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="edit-industry">Industry</Label><Input id="edit-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="edit-status">Status</Label><select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm"><option value="DRAFT">DRAFT</option><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || !name.trim()}>{submitting ? 'Saving...' : 'Save Changes'}</Button></div>
      </form>
    </Dialog>
  );
}
