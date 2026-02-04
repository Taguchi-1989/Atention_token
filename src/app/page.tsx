import DashboardLayout from '@/components/DashboardLayout';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import { ArrowUpRight, Activity, Users, Layers, Zap, Clock } from 'lucide-react';

export default function Home() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="relative py-12 px-6 rounded-3xl overflow-hidden bg-gradient-to-r from-surface-highlight to-surface border border-white/5 shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Zap size={300} strokeWidth={1} />
           </div>
           
           <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    System Operational
                </div>
                
                <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-blue-100 to-white/40">
                    Attention<span className="font-light text-primary">Ledger</span>
                </h2>
                
                <p className="text-text-muted text-lg md:text-xl max-w-2xl leading-relaxed">
                    Quantify software cognitive load using autonomous AI agents. 
                    <br className="hidden md:block"/>Measure attention cost in tokens, optimize for human efficiency.
                </p>

                <div className="flex flex-wrap gap-4 mt-8">
                    <Link href="/tasks" className="btn-primary flex items-center gap-2 px-6 py-3 text-sm md:text-base group">
                        Deploy Agent
                        <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>
                    <Link href="/ledger" className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-white font-medium text-sm md:text-base">
                        View Audit Log
                    </Link>
                </div>
           </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={<Users size={20} className="text-secondary" />}
            label="Active Agents" 
            value="1" 
            sub="Local Instance"
            trend="+0%" 
          />
          <StatCard 
            icon={<Layers size={20} className="text-primary" />}
            label="Scenarios" 
            value="4" 
            sub="YAML Definitions"
            trend="+2 New"
            trendUp
          />
          <StatCard 
            icon={<Zap size={20} className="text-yellow-400" />}
            label="Avg. Cost" 
            value="342" 
            sub="Tokens / Task"
            trend="-12%"
            trendUp={false} 
          />
          <StatCard 
            icon={<Clock size={20} className="text-success" />}
            label="Uptime" 
            value="99.9%" 
            sub="Since Reboot"
            trend="Stable"
          />
        </div>

        {/* Dashboards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions / Recent Tasks */}
            <div className="lg:col-span-2 glass-panel p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Activity size={20} className="text-primary" />
                        Recent Activity
                    </h3>
                    <Link href="/ledger" className="text-xs text-primary hover:underline">View All</Link>
                </div>
                
                <div className="space-y-4">
                    {/* Mock Activity Items */}
                    <ActivityItem 
                        task="SHOPPING_CART_V1" 
                        status="Success" 
                        time="2 mins ago" 
                        tokens="1,240"
                    />
                     <ActivityItem 
                        task="INQUIRY_FORM_V1" 
                        status="Failed" 
                        time="15 mins ago" 
                        tokens="450"
                        failed
                    />
                    <ActivityItem 
                        task="EXPENSE_INPUT_V1" 
                        status="Success" 
                        time="1 hour ago" 
                        tokens="890"
                    />
                </div>
            </div>

            {/* System Status / Mini Info */}
            <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                 
                 <div>
                    <h3 className="text-lg font-semibold mb-2">System Health</h3>
                    <p className="text-sm text-text-muted mb-6">All systems nominal. Connection to Ollama local instance is stable.</p>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-text-muted">CPU Usage</span>
                            <span className="text-white font-mono">12%</span>
                        </div>
                        <div className="w-full bg-surface-highlight rounded-full h-1.5 overflow-hidden">
                            <div className="bg-success h-full rounded-full" style={{ width: '12%' }}></div>
                        </div>

                        <div className="flex justify-between text-sm mt-2">
                            <span className="text-text-muted">Memory</span>
                            <span className="text-white font-mono">45%</span>
                        </div>
                        <div className="w-full bg-surface-highlight rounded-full h-1.5 overflow-hidden">
                            <div className="bg-secondary h-full rounded-full" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                 </div>

                 <div className="mt-8 pt-4 border-t border-white/5">
                    <button className="w-full py-2 rounded bg-surface-highlight hover:bg-white/10 transition-colors text-sm font-medium text-text-muted hover:text-white">
                        System Diagnostics
                    </button>
                 </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ 
    label, value, sub, icon, trend, trendUp 
}: { 
    label: string, 
    value: string, 
    sub: string, 
    icon?: React.ReactNode, 
    trend?: string, 
    trendUp?: boolean 
}) {
    return (
        <div className="glass-panel p-6 hover:border-primary/20 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-surface-highlight text-text-muted group-hover:text-white group-hover:bg-white/10 transition-colors">
                    {icon}
                </div>
                {trend && (
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendUp ? 'bg-success/10 text-success' : 'bg-surface-highlight text-text-muted'}`}>
                        {trend}
                    </div>
                )}
            </div>
            <div className="text-3xl font-bold mb-1 text-white tracking-tight">{value}</div>
            <div className="text-sm text-text-muted font-medium mb-1">{label}</div>
            <div className="text-xs text-text-muted/60">{sub}</div>
        </div>
    )
}

function ActivityItem({ task, status, time, tokens, failed }: { task: string, status: string, time: string, tokens: string, failed?: boolean }) {
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
    )
}
