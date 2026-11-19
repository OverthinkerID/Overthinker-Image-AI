'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, UserCheck } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface ClientItem { id: string; name: string; companyName: string | null; contactPerson: string | null; email: string | null; industry: string | null; isArchived: boolean; projects: Array<{ id: string; status: string; project: { id: string; name: string } }>; }

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('');

  const headers = () => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { 'Content-Type': 'application/json', ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const load = async (q = search) => {
    const res = await fetch(`${API_BASE}/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`, { credentials: 'include', headers: headers() });
    if (res.ok) setClients((await res.json()).data || []);
  };

  useEffect(() => { load(); }, []);

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/clients`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ name, companyName, email, industry }) });
    if (res.ok) { setName(''); setCompanyName(''); setEmail(''); setIndustry(''); load(); }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage agency clients, contacts, and linked brand projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} placeholder="Search clients..." className="rounded-md border bg-card pl-8 pr-3 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      <form onSubmit={createClient} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name *" required className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4 text-primary" /> {c.name}</div>
              <span className="text-xs text-muted-foreground">{c.industry || 'General'}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.companyName || 'Independent'} · {c.email || 'No email'}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.projects.length === 0 ? <span className="text-xs text-muted-foreground">No linked projects</span> : c.projects.map((p) => (
                <span key={p.id} className="rounded border px-2 py-0.5 text-xs">{p.project.name} ({p.status})</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
