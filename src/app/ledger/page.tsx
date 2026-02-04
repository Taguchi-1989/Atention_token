'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchRuns } from '@/lib/api';
import { CheckCircle2, XCircle, Clock, Zap, FileJson } from 'lucide-react';
// import { clsx } from 'clsx'; // Assuming clsx is installed or use template literal

interface HistoryItem {
  id: number;
  task_id: string;
  baseline_id: string;
  executed_at: string;
  success: boolean;
  failure_reason: string | null;
  total_tokens: number;
  metrics?: Record<string, unknown> | null;
}

export default function LedgerPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns(true)
      .then(data => setHistory(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <header className="mb-8 flex justify-between items-end">
         <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Execution Ledger
            </h2>
            <p className="text-text-muted mt-2">Audit trail of all agent execution runs and cost metrics.</p>
         </div>
         <button 
           onClick={() => fetchRuns(true).then(setHistory)} 
           className="btn-ghost text-sm"
         >
           Refresh List
         </button>
      </header>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/5 bg-surface-highlight/30 text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold">Task ID</th>
                        <th className="p-4 font-semibold">Baseline</th>
                        <th className="p-4 font-semibold">Cost (Tokens)</th>
                        <th className="p-4 font-semibold">SUS</th>
                        <th className="p-4 font-semibold">Executed At</th>
                        <th className="p-4 font-semibold">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                    {loading ? (
                         <tr><td colSpan={7} className="p-8 text-center text-text-muted">Loading ledger...</td></tr>
                    ) : history.length === 0 ? (
                         <tr><td colSpan={7} className="p-8 text-center text-text-muted">No records found. Run a task first.</td></tr>
                    ) : (
                        history.map((row) => (
                            <tr key={row.id} className="group hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                    {row.success ? (
                                        <div className="flex items-center gap-2 text-success">
                                            <CheckCircle2 size={18} />
                                            <span>Success</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-error" title={row.failure_reason || 'Unknown Error'}>
                                            <XCircle size={18} />
                                            <span>Failed</span>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 font-medium text-white font-mono">{row.task_id}</td>
                                <td className="p-4 text-text-muted">{row.baseline_id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5 font-mono text-primary">
                                        <Zap size={14} />
                                        {row.total_tokens.toLocaleString()}
                                    </div>
                                </td>
                                <td className="p-4 text-text-muted">
                                    {row.metrics?.sus_inspired_score != null ? (
                                        <span className="text-primary font-semibold">
                                            {Number(row.metrics?.sus_inspired_score).toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-text-muted/60">-</span>
                                    )}
                                </td>
                                <td className="p-4 text-text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        {new Date(row.executed_at).toLocaleString()}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <button className="text-text-muted hover:text-white transition-colors" title="View Logs (Not Implemented)">
                                        <FileJson size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
