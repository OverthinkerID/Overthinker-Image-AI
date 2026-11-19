'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, type Project, type ProjectStatus } from '@/lib/api';

export function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (p: Project) => void }) {
  const [name, setName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<ProjectStatus>('DRAFT');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      const created = await api.createProject({ name, industry: industry || undefined, description: description || undefined, status });
      setName(''); setIndustry(''); setDescription(''); setStatus('DRAFT');
      onCreated(created); onOpenChange(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create project'); } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New Brand Project" description="Create a local-first brand identity workspace.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="create-name">Project Name *</Label><Input id="create-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="create-industry">Industry</Label><Input id="create-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="create-status">Status</Label><select id="create-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm"><option value="DRAFT">DRAFT</option><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="create-description">Description</Label><Textarea id="create-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || !name.trim()}>{submitting ? 'Creating...' : 'Create Project'}</Button></div>
      </form>
    </Dialog>
  );
}
