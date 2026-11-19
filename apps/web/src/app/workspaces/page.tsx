'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Settings2, Archive } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface Workspace { id: string; name: string; slug: string; type: string; role: string; isArchived: boolean; settings?: { aiMode: string; defaultProvider: string; storageProvider: string }; }
interface ActivityItem { id: string; action: string; summary: string; createdAt: string; }

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'PERSONAL' | 'AGENCY' | 'COMPANY' | 'CLIENT'>('AGENCY');
  const [msg, setMsg] = useState('');

  const headers = () => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { 'Content-Type': 'application/json', ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const load = async () => {
    const [wRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/workspaces`, { credentials: 'include', headers: headers() }),
      fetch(`${API_BASE}/workspaces/current/activity`, { credentials: 'include', headers: headers() }),
    ]);
    if (wRes.ok) setWorkspaces((await wRes.json()).data || []);
    if (aRes.ok) setActivity((await aRes.json()).data || []);
  };

  useEffect(() => { load(); }, []);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`${API_BASE}/workspaces`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ name, type }) });
    const json = await res.json();
    if (!res.ok) { setMsg(json?.error?.message || 'Failed to create workspace'); return; }
    setName('');
    setMsg(`Workspace "${json.data.name}" created.`);
    load();
  };

  const switchWs = async (id: string) => {
    window.localStorage.setItem('bf_active_workspace', id);
    await fetch(`${API_BASE}/workspaces/${encodeURIComponent(id)}/switch`, { method: 'POST', credentials: 'include' });
    window.location.reload();
  };

  const archiveWs = async () => {
    await fetch(`${API_BASE}/workspaces/current`, { method: 'PATCH', credentials: 'include', headers: headers(), body: JSON.stringify({ isArchived: true }) });
    load();
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Manage Personal, Agency, Company, and Client workspaces with strict tenant isolation.</p>
        </div>
      </div>

      {msg && <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">{msg}</div>}

      <form onSubmit={createWorkspace} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New workspace name..." required className="sm:col-span-2 rounded-md border bg-background px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="PERSONAL">Personal</option>
          <option value="AGENCY">Agency</option>
          <option value="COMPANY">Company</option>
          <option value="CLIENT">Client</option>
        </select>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Create Workspace
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {workspaces.map((ws) => (
          <div key={ws.id} className="flex flex-col justify-between rounded-xl border bg-card p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-primary" /> {ws.name}</div>
                <span className="rounded border px-2 py-0.5 text-xs">{ws.type} · {ws.role}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Slug: {ws.slug} {ws.isArchived ? '· Archived' : ''}</p>
              {ws.settings && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Settings2 className="h-3.5 w-3.5" /> AI: {ws.settings.aiMode} ({ws.settings.defaultProvider}) · Storage: {ws.settings.storageProvider}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => switchWs(ws.id)} className="rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25">Switch Active</button>
              <button onClick={archiveWs} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Archive className="h-3.5 w-3.5" /> Archive Current
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Workspace Activity History</h2>
        <div className="space-y-2 text-xs">
          {activity.length === 0 ? <p className="text-muted-foreground">No activity recorded yet.</p> : activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
              <span><strong>{a.action}</strong> — {a.summary}</span>
              <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
