'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Play, History, Settings, Zap, ListChecks, FlaskConical, Wine, ShieldCheck, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background font-sans text-white lg:flex-row">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-controls="dashboard-navigation"
          aria-expanded={navOpen}
          aria-label={navOpen ? 'ナビゲーションを閉じる' : 'ナビゲーションを開く'}
          onClick={() => setNavOpen((open) => !open)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {navOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="ナビゲーションを閉じる"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-navigation"
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface p-5 transition-transform duration-200 lg:static lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-center justify-between pl-3">
          <Brand />
          <button
            type="button"
            aria-label="ナビゲーションを閉じる"
            onClick={() => setNavOpen(false)}
            className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="space-y-1 flex-1">
          <NavItem href="/" icon={<LayoutDashboard size={20} />} label="概要" pathname={pathname} />
          <NavItem href="/tasks" icon={<Play size={20} />} label="タスク" pathname={pathname} />
          <NavItem href="/sus" icon={<ListChecks size={20} />} label="SUS 評価" pathname={pathname} />
          <NavItem href="/ledger" icon={<History size={20} />} label="実行台帳" pathname={pathname} />
          <NavItem href="/hermes" icon={<ShieldCheck size={20} />} label="Hermes" pathname={pathname} />
          <NavItem href="/results" icon={<FlaskConical size={20} />} label="実験結果" pathname={pathname} />
          <NavItem href="/settings" icon={<Settings size={20} />} label="設定" pathname={pathname} />
          <NavItem href="/talkbalancer" icon={<Wine size={20} />} label="TalkBalancer" pathname={pathname} />
        </nav>

        <div className="text-xs text-text-muted text-center mt-4">
          v0.1.0 (Local MVP)
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
        <Zap size={18} className="fill-current text-white" />
      </div>
      <div className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
        Ledger
      </div>
    </div>
  );
}

function NavItem({ href, icon, label, pathname }: { href: string; icon: React.ReactNode; label: string; pathname: string }) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Link 
      href={href} 
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
        isActive 
          ? "bg-surface-highlight text-white border-l-2 border-primary" 
          : "text-text-muted hover:text-white hover:bg-white/5"
      )}
    >
      <span className={clsx("transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-white")}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
