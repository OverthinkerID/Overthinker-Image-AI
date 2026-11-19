'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { API_BASE } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'login' ? { email, password, totpCode: totpCode || undefined } : { email, password, name }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || 'Authentication failed'); return; }
    if (json.data?.activeWorkspaceId) window.localStorage.setItem('bf_active_workspace', json.data.activeWorkspaceId);
    if (json.data?.workspace?.id) window.localStorage.setItem('bf_active_workspace', json.data.workspace.id);
    router.push('/');
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><Lock className="h-5 w-5 text-primary" /> {mode === 'login' ? 'Sign In' : 'Create Account'}</div>
        {error && <div className="mb-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (min 8 chars)" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          {mode === 'login' && <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="2FA Code (if enabled)" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />}
          <button type="submit" className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">{mode === 'login' ? 'Sign In' : 'Register'}</button>
        </form>
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  );
}
