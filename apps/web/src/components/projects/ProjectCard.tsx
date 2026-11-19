'use client';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getLogoFileUrl, type Project } from '@/lib/api';

const STATUS_VARIANTS = { DRAFT: 'warning', ACTIVE: 'success', ARCHIVED: 'secondary' } as const;

export function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: (p: Project) => void; onDelete: (p: Project) => void }) {
  const primaryLogo = project.logos.find((l) => l.isPrimary) || project.logos[0];
  return (
    <Card className="flex flex-col justify-between transition-colors hover:border-primary/50">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="line-clamp-1">{project.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{project.industry || 'General Brand'} · {project.logos.length} {project.logos.length === 1 ? 'logo' : 'logos'}</p>
            </div>
            <Badge variant={STATUS_VARIANTS[project.status]}>{project.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-32 items-center justify-center overflow-hidden rounded-md border border-dashed bg-background/60 p-3">
            {primaryLogo ? <img src={getLogoFileUrl(primaryLogo.id)} alt={`${project.name} primary logo`} className="max-h-full max-w-full object-contain" /> : <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="h-6 w-6 opacity-50" /><span>No logo uploaded yet</span></div>}
          </div>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{project.description || 'No description provided.'}</p>
        </CardContent>
      </div>
      <CardFooter className="justify-between gap-2 border-t pt-4">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(project)} title="Edit project"><Pencil className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(project)} title="Delete project" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
        <Link href={`/projects/${project.id}`}><Button size="sm" variant="secondary">Open Studio<ArrowRight className="h-3.5 w-3.5" /></Button></Link>
      </CardFooter>
    </Card>
  );
}
