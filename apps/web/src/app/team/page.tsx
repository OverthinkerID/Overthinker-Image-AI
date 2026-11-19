'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface Member { id: string; role: string; user: { id: string; name: string; email: string }; }
interface Invitation { id: string; email: string; role: string; status: string; createdAt: string; }

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DESIGNER');
  const [msg, setMsg] = useState('');

  const headers = () => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    return { 'Content-Type': 'application/json', ...(ws ? { 'x-workspace-id': ws } : {}) };
  };

  const load = async () => {
    const [mRes, iRes] = await Promise.all([
      fetch(`${API_BASE}/workspaces/current/members`, { credentials: 'include', headers: headers() }),
      fetch(`${API_BASE}/workspaces/current/invitations`, { credentials: 'include', headers: headers() }),
    ]);
    if (mRes.ok) setMembers((await mRes.json()).data || []);
    if (iRes.ok) setInvitations((await iRes.json()).data || []);
  };

  useEffect(() => { load(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/workspaces/current/invitations`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify({ email, role }) });
    const json = await res.json();
    if (!res.ok) { setMsg(json?.error?.message || 'Invite failed'); return; }
    setEmail('');
    setMsg(`Invitation created (token: ${json.data.inviteToken})`);
    load();
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team & RBAC Permissions</h1>
        <p className="text-sm text-muted-foreground">Invite members and manage workspace roles (Owner, Admin, Designer, Reviewer, Client).</p>
      </div>
      {msg && <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs">{msg}</div>}

      <form onSubmit={invite} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="teammate@agency.com" className="sm:col-span-2 rounded-md border bg-background px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="ADMIN">Admin</option>
          <option value="DESIGNER">Designer</option>
          <option value="REVIEWER">Reviewer</option>
          <option value="CLIENT">Client</option>
        </select>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <UserPlus className="h-4 w-4" /> Send Invite
        </button>
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" /> Workspace Members</h2>
          <div className="space-y-2 text-sm">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div><div className="font-medium">{m.user.name}</div><div className="text-xs text-muted-foreground">{m.user.email}</div></div>
                <span className="rounded border px-2 py-0.5 text-xs font-medium">{m.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Pending Invitations</h2>
          <div className="space-y-2 text-sm">
            {invitations.length === 0 ? <p className="text-xs text-muted-foreground">No invitations sent.</p> : invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div><div className="font-medium">{inv.email}</div><div className="text-xs text-muted-foreground">{inv.role} · {inv.status}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
