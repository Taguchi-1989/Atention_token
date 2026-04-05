'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchRuns, fetchBaselines, fetchMetricsDiff } from '@/lib/api';
import React from 'react';
import { CheckCircle2, XCircle, Clock, Zap, FileJson, BarChart3, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface HistoryItem {
  id: number;
  task_id: string;
  baseline_id: string;
  executed_at: string;
  success: boolean;
  failure_reason: string | null;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  step_count: number;
  retry_count: number;
  metrics?: Record<string, unknown> | null;
}

interface Baseline {
  baseline_id: string;
}

interface DiffBaseline {
  id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  step_count: number;
  retry_count: number;
  run_count: number;
  [key: string]: string | number;
}

interface DiffResult {
  task_id: string;
  baseline_a: DiffBaseline;
  baseline_b: DiffBaseline;
  delta: Record<string, number>;
}

export default function LedgerPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Diff state
  const [showDiff, setShowDiff] = useState(false);
  const [diffTaskId, setDiffTaskId] = useState('');
  const [diffA, setDiffA] = useState('');
  const [diffB, setDiffB] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');

  useEffect(() => {
    Promise.all([fetchRuns(true), fetchBaselines()])
      .then(([runs, bls]) => { setHistory(runs); setBaselines(bls); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const uniqueTaskIds = Array.from(new Set(history.map(h => h.task_id)));

  const handleDiff = async () => {
    if (!diffTaskId || !diffA || !diffB) return;
    setDiffLoading(true);
    setDiffError('');
    setDiffResult(null);
    try {
      const result = await fetchMetricsDiff(diffTaskId, diffA, diffB);
      setDiffResult(result);
    } catch {
      setDiffError('No matching records found for this combination.');
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Execution Ledger
          </h2>
          <p className="text-text-muted mt-2">Audit trail of all agent execution runs and cost metrics.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowDiff(!showDiff)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${showDiff ? 'bg-primary/10 border-primary/30 text-primary' : 'border-white/10 text-text-muted hover:text-white hover:bg-white/5'}`}
          >
            <BarChart3 size={16} />
            Compare Baselines
          </button>
          <button
            type="button"
            onClick={() => fetchRuns(true).then(setHistory)}
            className="btn-ghost text-sm"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Diff Panel */}
      {showDiff && (
        <div className="glass-panel p-6 mb-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            Metrics Comparison
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-text-muted block mb-1">Task</label>
              <select
                title="Select task for comparison"
                value={diffTaskId}
                onChange={e => setDiffTaskId(e.target.value)}
                className="w-full bg-surface-highlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select task</option>
                {uniqueTaskIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Baseline A</label>
              <select
                title="Select baseline A"
                value={diffA}
                onChange={e => setDiffA(e.target.value)}
                className="w-full bg-surface-highlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select</option>
                {baselines.map(bl => <option key={bl.baseline_id} value={bl.baseline_id}>{bl.baseline_id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Baseline B</label>
              <select
                title="Select baseline B"
                value={diffB}
                onChange={e => setDiffB(e.target.value)}
                className="w-full bg-surface-highlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select</option>
                {baselines.map(bl => <option key={bl.baseline_id} value={bl.baseline_id}>{bl.baseline_id}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={handleDiff} disabled={diffLoading || !diffTaskId || !diffA || !diffB} className="btn-primary text-sm px-6 py-2 w-full disabled:opacity-50">
                {diffLoading ? 'Loading...' : 'Compare'}
              </button>
            </div>
          </div>

          {diffError && <p className="text-error text-sm">{diffError}</p>}

          {diffResult && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted text-xs uppercase tracking-wider">
                    <th className="text-left p-3">Metric</th>
                    <th className="text-right p-3">{diffResult.baseline_a.id ?? diffA}</th>
                    <th className="text-right p-3">{diffResult.baseline_b.id ?? diffB}</th>
                    <th className="text-right p-3">Delta</th>
                    <th className="text-right p-3">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {['total_tokens', 'input_tokens', 'output_tokens', 'step_count', 'retry_count'].map(key => {
                    const va = Number(diffResult.baseline_a[key] ?? 0);
                    const vb = Number(diffResult.baseline_b[key] ?? 0);
                    const delta = Number(diffResult.delta[key] ?? 0);
                    const pct = Number(diffResult.delta[`${key}_pct`] ?? 0);
                    const improved = delta < 0;
                    return (
                      <tr key={key} className="hover:bg-white/5">
                        <td className="p-3 text-white font-medium">{key.replace(/_/g, ' ')}</td>
                        <td className="p-3 text-right font-mono text-text-muted">{va.toFixed(1)}</td>
                        <td className="p-3 text-right font-mono text-text-muted">{vb.toFixed(1)}</td>
                        <td className={`p-3 text-right font-mono font-bold ${improved ? 'text-success' : delta > 0 ? 'text-error' : 'text-text-muted'}`}>
                          <span className="inline-flex items-center gap-1">
                            {improved ? <ArrowDownRight size={14} /> : delta > 0 ? <ArrowUpRight size={14} /> : null}
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-mono text-xs ${improved ? 'text-success' : delta > 0 ? 'text-error' : 'text-text-muted'}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Execution History Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-surface-highlight/30 text-xs uppercase tracking-wider text-text-muted">
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Task ID</th>
                <th className="p-4 font-semibold">Baseline</th>
                <th className="p-4 font-semibold">Tokens</th>
                <th className="p-4 font-semibold">Steps</th>
                <th className="p-4 font-semibold">SUS</th>
                <th className="p-4 font-semibold">Executed At</th>
                <th className="p-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-text-muted">Loading ledger...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-text-muted">No records found. Run a task first.</td></tr>
              ) : (
                history.map(row => (
                  <React.Fragment key={row.id}>
                    <tr className="group hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        {row.success ? (
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle2 size={18} /> Success
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-error" title={row.failure_reason || ''}>
                            <XCircle size={18} /> Failed
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-medium text-white font-mono">{row.task_id}</td>
                      <td className="p-4 text-text-muted">{row.baseline_id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-mono text-primary">
                          <Zap size={14} /> {(row.total_tokens ?? 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-text-muted font-mono">{row.step_count}</td>
                      <td className="p-4 text-text-muted">
                        {row.metrics?.sus_inspired_score != null ? (
                          <span className="text-primary font-semibold">
                            {Number(row.metrics.sus_inspired_score).toFixed(1)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-text-muted">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          {new Date(row.executed_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          title="Toggle details"
                          onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                          className="text-text-muted hover:text-white transition-colors"
                        >
                          <FileJson size={18} />
                        </button>
                      </td>
                    </tr>
                    {expandedRow === row.id && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={8} className="p-4 bg-surface-highlight/20">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-text-muted text-xs block">Input Tokens</span>
                              <span className="font-mono text-white">{(row.input_tokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-text-muted text-xs block">Output Tokens</span>
                              <span className="font-mono text-white">{(row.output_tokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-text-muted text-xs block">Retry Count</span>
                              <span className="font-mono text-white">{row.retry_count}</span>
                            </div>
                            <div>
                              <span className="text-text-muted text-xs block">Failure Reason</span>
                              <span className="font-mono text-white">{row.failure_reason || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
