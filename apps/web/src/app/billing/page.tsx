'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Gauge } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface UsageSummary { totals: Record<string, number>; storageMb: number; warnings: string[]; plan: { name: string; code: string; aiImageQuota: number; storageQuotaMb: number } | null; }
interface Plan { id: string; code: string; name: string; description: string | null; monthlyPriceCents: number; currency: string; projectLimit: number; memberLimit: number; aiImageQuota: number; storageQuotaMb: number; }

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    const ws = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    const h: Record<string, string> = ws ? { 'x-workspace-id': ws } : {};
    Promise.all([
      fetch(`${API_BASE}/usage/summary`, { credentials: 'include', headers: h }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/billing/plans`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([u, p]) => {
      if (u?.data) setUsage(u.data);
      if (p?.data) setPlans(p.data);
    }).catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage & Billing</h1>
        <p className="text-sm text-muted-foreground">Monitor workspace AI/storage usage and configurable subscription entitlements.</p>
      </div>

      {usage && (
        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> AI Image Gens</div><div className="mt-1 text-2xl font-semibold">{usage.totals.AI_IMAGE_GEN || 0}</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">AI Text Gens</div><div className="mt-1 text-2xl font-semibold">{usage.totals.AI_TEXT_GEN || 0}</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Storage Used</div><div className="mt-1 text-2xl font-semibold">{usage.storageMb} MB</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /> Active Plan</div><div className="mt-1 text-xl font-semibold">{usage.plan?.name || 'Local Studio'}</div></div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Configured Subscription Plans</h2>
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No subscription plans configured yet. Platform admins can configure plans via the Admin API without hardcoded pricing.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border p-4">
                <div className="font-semibold">{p.name} ({p.code})</div>
                <div className="mt-1 text-lg font-bold">{(p.monthlyPriceCents / 100).toFixed(2)} {p.currency}/mo</div>
                <div className="mt-2 text-xs text-muted-foreground">Projects: {p.projectLimit} · Members: {p.memberLimit} · AI Images: {p.aiImageQuota} · Storage: {p.storageQuotaMb} MB</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
