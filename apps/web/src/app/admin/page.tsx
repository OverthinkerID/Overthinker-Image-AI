'use client';

import { useEffect, useState } from 'react';
import { Activity, Server } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface Overview { systemHealth: string; usersCount: number; workspacesCount: number; projectsCount: number; activeBackgroundJobs: number; totalTrackedStorageBytes: number; aiProviders: Array<{ id: string; name: string; providerType: string; healthStatus: string }>; }

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/admin/overview`, { credentials: 'include' })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error?.message || 'Admin access required');
        setOverview(json.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load admin overview'));
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Server className="h-6 w-6 text-primary" /> Platform Administration</h1>
        <p className="text-sm text-muted-foreground">Monitor system health, AI providers, workspaces, background jobs, and audited activity.</p>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">System Health</div><div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-emerald-500"><Activity className="h-4 w-4" /> {overview.systemHealth}</div></div>
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Users</div><div className="mt-1 text-2xl font-semibold">{overview.usersCount}</div></div>
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Workspaces</div><div className="mt-1 text-2xl font-semibold">{overview.workspacesCount}</div></div>
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Active Jobs</div><div className="mt-1 text-2xl font-semibold">{overview.activeBackgroundJobs}</div></div>
          </div>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">AI Provider Status</h2>
            <div className="space-y-2 text-sm">
              {overview.aiProviders.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <span>{p.name} ({p.providerType})</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{p.healthStatus}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
