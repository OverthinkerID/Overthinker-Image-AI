'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChevronDown, CreditCard, Layers, Shield, Sparkles, UserCheck, Users } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface WorkspaceItem { id: string; name: string; type: string; role: string; }

export function Header() {
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWsId, setActiveWsId] = useState<string>('');
  const [isLocalMode, setIsLocalMode] = useState(true);
  const [userName, setUserName] = useState<string>('Local Studio');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('bf_active_workspace') : null;
    if (saved) setActiveWsId(saved);
    fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers: saved ? { 'x-workspace-id': saved } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res?.data) return;
        setWorkspaces(res.data.workspaces || []);
        setActiveWsId(res.data.activeWorkspaceId || '');
        setIsLocalMode(Boolean(res.data.isLocalDefaultMode));
        if (res.data.user?.name) setUserName(res.data.user.name);
      })
      .catch(() => undefined);
  }, [pathname]);

  const handleSwitchWorkspace = async (wsId: string) => {
    setActiveWsId(wsId);
    if (typeof window !== 'undefined') window.localStorage.setItem('bf_active_workspace', wsId);
    await fetch(`${API_BASE}/workspaces/${encodeURIComponent(wsId)}/switch`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    window.location.reload();
  };

  const navItems = [
    { href: '/', label: 'Projects' },
    { href: '/workspaces', label: 'Workspaces', icon: Building2 },
    { href: '/clients', label: 'Clients', icon: UserCheck },
    { href: '/team', label: 'Team', icon: Users },
    { href: '/portal', label: 'Client Portal', icon: Shield },
    { href: '/billing', label: 'Usage & Billing', icon: CreditCard },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#2b3c1f] bg-[#394f29] text-[#f4f7f1] shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141812] text-[#a7d487] ring-1 ring-white/15">
              <Layers className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Overthinker Image AI</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/15 bg-black/20 p-1 backdrop-blur-md md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`ot-pill inline-flex items-center px-3.5 text-xs font-medium ${
                    isActive
                      ? 'bg-[#141812] text-white shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {workspaces.length > 0 && (
            <div className="relative flex items-center">
              <select
                aria-label="Workspace Switcher"
                value={activeWsId}
                onChange={(e) => handleSwitchWorkspace(e.target.value)}
                className="ot-pill appearance-none border border-white/20 bg-[#141812]/80 pl-3.5 pr-8 text-xs font-medium text-white focus:outline-none"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id} className="bg-[#141812] text-white">
                    {ws.name} ({ws.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none -ml-6 h-3.5 w-3.5 text-white/70" />
            </div>
          )}

          <Link
            href="/admin"
            title="Admin"
            className="ot-pill hidden items-center border border-white/20 bg-black/20 px-3.5 text-xs font-medium text-white/90 hover:bg-white/10 lg:inline-flex"
          >
            Admin
          </Link>

          <Link
            href="/login"
            title={isLocalMode ? 'Local Studio' : userName}
            className="ot-pill inline-flex items-center gap-1.5 border border-white/20 bg-[#141812] px-3.5 text-white hover:bg-black"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#a7d487]" />
            <span>{isLocalMode ? 'Local Studio' : userName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
