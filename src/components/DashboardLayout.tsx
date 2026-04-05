'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Play, History, Settings, Zap, ListChecks } from 'lucide-react';
import { clsx } from 'clsx';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col p-5">
        <div className="mb-8 pl-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
             <Zap size={18} className="text-white fill-current" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Ledger
          </h1>
        </div>
        
        <nav className="space-y-1 flex-1">
          <NavItem href="/" icon={<LayoutDashboard size={20} />} label="概要" />
          <NavItem href="/tasks" icon={<Play size={20} />} label="タスク" />
          <NavItem href="/sus" icon={<ListChecks size={20} />} label="SUS 評価" />
          <NavItem href="/ledger" icon={<History size={20} />} label="実行台帳" />
          <NavItem href="/settings" icon={<Settings size={20} />} label="設定" />
        </nav>

        <div className="text-xs text-text-muted text-center mt-4">
          v0.1.0 (Local MVP)
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

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
