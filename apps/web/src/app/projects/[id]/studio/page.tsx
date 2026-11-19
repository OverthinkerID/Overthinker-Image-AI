'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DesignStudioWorkspace } from '@/components/design-studio/DesignStudioWorkspace';

export default function ProjectDesignStudioPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/projects/${params.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to Brand Project</Link>
        <h1 className="text-2xl font-bold tracking-tight">Design Studio & Asset Generator</h1>
      </div>
      <DesignStudioWorkspace projectId={params.id} />
    </div>
  );
}
