'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface SharedProject { id: string; projectId: string; project: { id: string; name: string; status: string; industry: string | null }; }

export default function ClientPortalPage() {
  const [projects, setProjects] = useState<SharedProject[]>([]);

  useEffect(() => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    fetch(`${API_BASE}/portal/projects`, { credentials: 'include', headers: ws ? { 'x-workspace-id': ws } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.data) setProjects(res.data); })
      .catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Shield className="h-6 w-6 text-primary" /> Client Portal</h1>
        <p className="text-sm text-muted-foreground">Dedicated client review space with strict isolation from internal agency notes, AI credentials, and unshared drafts.</p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No client portal projects are currently shared with your account. Agency owners can grant access from the Clients module.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{item.project.name}</h2>
                <span className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> {item.project.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.project.industry || 'Brand Identity Review'}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
