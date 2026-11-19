'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AutomationDashboardWorkspace } from '@/components/automation/AutomationDashboardWorkspace';

export default function ProjectAutomationPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/projects/${params.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to Brand Project</Link>
        <h1 className="text-2xl font-bold tracking-tight">Workflow Automation & Commercial Export</h1>
      </div>
      <AutomationDashboardWorkspace projectId={params.id} />
    </div>
  );
}
