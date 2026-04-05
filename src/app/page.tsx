'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import { fetchStats, fetchRuns, fetchTasks } from '@/lib/api';
import { ArrowUpRight, Activity, Users, Layers, Zap, Clock, RefreshCw } from 'lucide-react';

interface Stats {
  total_runs: number;
  success_runs: number;
  unique_tasks: number;
  total_baselines: number;
  total_tokens: number;
}

interface RunItem {
  id: number;
  task_id: string;
  baseline_id: string;
  executed_at: string;
  success: boolean;
  total_tokens: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunItem[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const loadData = () => {
    setApiOk(null);
    Promise.all([
      fetchStats().then(setStats),
      fetchRuns().then((runs: RunItem[]) => setRecentRuns(runs.slice(0, 5))),
      fetchTasks().then((tasks: unknown[]) => setTaskCount(tasks.length)),
    ])
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  };

  useEffect(() => { loadData(); }, []);

  const successRate = stats && stats.total_runs > 0
    ? Math.round((stats.success_runs / stats.total_runs) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="relative py-12 px-6 rounded-3xl overflow-hidden bg-gradient-to-r from-surface-highlight to-surface border border-white/5 shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Zap size={300} strokeWidth={1} />
           </div>

           <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${apiOk === false ? 'bg-error' : 'bg-primary'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${apiOk === false ? 'bg-error' : 'bg-primary'}`}></span>
                    </span>
                    {apiOk === false ? 'API オフライン' : apiOk === true ? 'システム稼働中' : '接続中...'}
                </div>

                <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-blue-100 to-white/40">
                    Attention<span className="font-light text-primary">Ledger</span>
                </h2>

                <p className="text-text-muted text-lg md:text-xl max-w-2xl leading-relaxed">
                    AIエージェントを使って、ソフトウェアの認知負荷を定量化。
                    <br className="hidden md:block"/>トークン消費量で注意力コストを測定し、人間の効率を最適化します。
                </p>

                <div className="flex flex-wrap gap-4 mt-8">
                    <Link href="/tasks" className="btn-primary flex items-center gap-2 px-6 py-3 text-sm md:text-base group">
                        タスク実行
                        <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>
                    <Link href="/ledger" className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-white font-medium text-sm md:text-base">
                        実行履歴を見る
                    </Link>
                </div>
           </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Layers size={20} className="text-primary" />}
            label="タスクシナリオ"
            value={String(taskCount)}
            sub="YAML 定義数"
          />
          <StatCard
            icon={<Zap size={20} className="text-yellow-400" />}
            label="総実行回数"
            value={stats ? String(stats.total_runs) : '-'}
            sub={`成功率 ${successRate}%`}
          />
          <StatCard
            icon={<Users size={20} className="text-secondary" />}
            label="ベースライン"
            value={stats ? String(stats.total_baselines) : '-'}
            sub="登録済み"
          />
          <StatCard
            icon={<Clock size={20} className="text-success" />}
            label="総トークン数"
            value={stats ? stats.total_tokens.toLocaleString() : '-'}
            sub="注意力コスト"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Activity size={20} className="text-primary" />
                        最近のアクティビティ
                    </h3>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={loadData} title="データを更新" className="text-text-muted hover:text-white transition-colors">
                            <RefreshCw size={16} />
                        </button>
                        <Link href="/ledger" className="text-xs text-primary hover:underline">すべて見る</Link>
                    </div>
                </div>

                <div className="space-y-4">
                    {recentRuns.length === 0 ? (
                        <div className="text-center py-8 text-text-muted">
                            まだ実行履歴がありません。<Link href="/tasks" className="text-primary hover:underline">タスクを実行</Link>して始めましょう。
                        </div>
                    ) : (
                        recentRuns.map(run => (
                            <ActivityItem
                                key={run.id}
                                task={run.task_id}
                                status={run.success ? '成功' : '失敗'}
                                time={formatRelativeTime(run.executed_at)}
                                tokens={(run.total_tokens ?? 0).toLocaleString()}
                                failed={!run.success}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                 <div>
                    <h3 className="text-lg font-semibold mb-2">クイックアクセス</h3>
                    <p className="text-sm text-text-muted mb-6">主要な機能へすぐにアクセス</p>

                    <div className="space-y-2">
                        <QuickLink href="/tasks" label="タスク実行" desc="エージェントでシナリオを実行" />
                        <QuickLink href="/sus" label="SUS 評価" desc="ユーザビリティ評価を送信" />
                        <QuickLink href="/ledger" label="実行台帳" desc="実行履歴と監査ログ" />
                        <QuickLink href="/settings" label="設定" desc="LLM 接続の設定" />
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
    label, value, sub, icon,
}: {
    label: string; value: string; sub: string; icon?: React.ReactNode;
}) {
    return (
        <div className="glass-panel p-6 hover:border-primary/20 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-surface-highlight text-text-muted group-hover:text-white group-hover:bg-white/10 transition-colors">
                    {icon}
                </div>
            </div>
            <div className="text-3xl font-bold mb-1 text-white tracking-tight">{value}</div>
            <div className="text-sm text-text-muted font-medium mb-1">{label}</div>
            <div className="text-xs text-text-muted/60">{sub}</div>
        </div>
    );
}

function ActivityItem({ task, status, time, tokens, failed }: { task: string; status: string; time: string; tokens: string; failed?: boolean }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${failed ? 'bg-error shadow-[0_0_8px_var(--error)]' : 'bg-success shadow-[0_0_8px_var(--success)]'}`}></div>
                <div>
                    <div className="font-medium text-sm text-white">{task}</div>
                    <div className="text-xs text-text-muted">{time}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-mono text-white/80">{tokens} <span className="text-xs text-text-muted">tok</span></div>
                <div className={`text-xs ${failed ? 'text-error' : 'text-success'}`}>{status}</div>
            </div>
        </div>
    );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
    return (
        <Link href={href} className="block p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
            <div className="text-sm font-medium text-white">{label}</div>
            <div className="text-xs text-text-muted">{desc}</div>
        </Link>
    );
}

function formatRelativeTime(isoStr: string): string {
    const then = new Date(isoStr).getTime();
    if (isNaN(then)) return '不明';
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'たった今';
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
}
