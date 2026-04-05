'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import MetricsChart from '@/components/MetricsChart';
import TrendChart from '@/components/TrendChart';
import { fetchRuns, fetchRunsForTask, getExportCsvUrl } from '@/lib/api';
import { CheckCircle2, XCircle, Clock, Zap, FileJson, Download, BarChart2, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

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

const CHART_METRIC_KEYS = ['total_tokens', 'input_tokens', 'output_tokens', 'step_count', 'retry_count'];
const TREND_METRIC_OPTIONS = [
  { key: 'total_tokens', label: 'Total Tokens' },
  { key: 'step_count', label: 'Steps' },
  { key: 'retry_count', label: 'Retries' },
  { key: 'sus_inspired_score', label: 'SUS Score' },
];

type ActiveSection = 'table' | 'compare' | 'trends';

export default function LedgerPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('table');

  // Compare state
  const [baselineAId, setBaselineAId] = useState('');
  const [baselineBId, setBaselineBId] = useState('');

  // Trends state
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [trendMetric, setTrendMetric] = useState('total_tokens');
  const [trendRuns, setTrendRuns] = useState<HistoryItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    fetchRuns(true)
      .then((data: HistoryItem[]) => {
        setHistory(data);
        if (data.length > 0) {
          setSelectedTaskId(data[0].task_id);
        }
        // Pre-fill baseline selectors with first two distinct baselines
        const baselines = Array.from(new Set(data.map((r: HistoryItem) => r.baseline_id)));
        if (baselines.length >= 1) setBaselineAId(baselines[0]);
        if (baselines.length >= 2) setBaselineBId(baselines[1]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load trend data when selectedTaskId changes
  useEffect(() => {
    if (!selectedTaskId) return;
    setTrendLoading(true);
    fetchRunsForTask(selectedTaskId)
      .then((data) => setTrendRuns(data as HistoryItem[]))
      .catch(console.error)
      .finally(() => setTrendLoading(false));
  }, [selectedTaskId]);

  // Derive unique task IDs and baseline IDs from history
  const taskIds = useMemo(() => Array.from(new Set(history.map(r => r.task_id))), [history]);
  const baselineIds = useMemo(() => Array.from(new Set(history.map(r => r.baseline_id))), [history]);

  // Build per-baseline average metrics for compare chart
  const baselineAData = useMemo<Record<string, number>>(() => {
    const rows = history.filter(r => r.baseline_id === baselineAId);
    if (!rows.length) return {};
    const result: Record<string, number> = {};
    for (const key of CHART_METRIC_KEYS) {
      const vals = rows.map(r => {
        if (key === 'total_tokens') return r.total_tokens;
        if (key === 'input_tokens') return r.input_tokens;
        if (key === 'output_tokens') return r.output_tokens;
        if (key === 'step_count') return r.step_count;
        if (key === 'retry_count') return r.retry_count;
        const v = r.metrics?.[key];
        return typeof v === 'number' ? v : 0;
      });
      result[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return result;
  }, [history, baselineAId]);

  const baselineBData = useMemo<Record<string, number>>(() => {
    const rows = history.filter(r => r.baseline_id === baselineBId);
    if (!rows.length) return {};
    const result: Record<string, number> = {};
    for (const key of CHART_METRIC_KEYS) {
      const vals = rows.map(r => {
        if (key === 'total_tokens') return r.total_tokens;
        if (key === 'input_tokens') return r.input_tokens;
        if (key === 'output_tokens') return r.output_tokens;
        if (key === 'step_count') return r.step_count;
        if (key === 'retry_count') return r.retry_count;
        const v = r.metrics?.[key];
        return typeof v === 'number' ? v : 0;
      });
      result[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return result;
  }, [history, baselineBId]);

  function handleExport() {
    const url = getExportCsvUrl(
      selectedTaskId || undefined,
      undefined,
    );
    window.open(url, '_blank');
  }

  function handleExportAll() {
    const url = getExportCsvUrl();
    window.open(url, '_blank');
  }

  const reload = () => {
    setLoading(true);
    fetchRuns(true)
      .then((data: HistoryItem[]) => setHistory(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <DashboardLayout>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Execution Ledger
          </h2>
          <p className="text-text-muted mt-2">Audit trail of all agent execution runs and cost metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportAll}
            className="flex items-center gap-2 btn-ghost text-sm text-primary hover:text-primary"
            title="Export all records as CSV"
          >
            <Download size={15} />
            Export All CSV
          </button>
          <button type="button" onClick={reload} className="btn-ghost text-sm">
            Refresh
          </button>
        </div>
      </header>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1 w-fit border border-white/5">
        {(
          [
            { key: 'table', icon: <FileJson size={15} />, label: 'Ledger' },
            { key: 'compare', icon: <BarChart2 size={15} />, label: 'Compare' },
            { key: 'trends', icon: <TrendingUp size={15} />, label: 'Trends' },
          ] as { key: ActiveSection; icon: React.ReactNode; label: string }[]
        ).map(tab => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeSection === tab.key
                ? 'bg-surface-highlight text-white border border-white/10'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ledger table */}
      {activeSection === 'table' && (
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
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted">Loading ledger...</td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted">No records found. Run a task first.</td>
                  </tr>
                ) : (
                  history.map(row => (
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
                        <button
                          type="button"
                          className="text-text-muted hover:text-white transition-colors"
                          title="View Logs (Not Implemented)"
                        >
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
      )}

      {/* Compare section */}
      {activeSection === 'compare' && (
        <div className="space-y-6">
          {/* Baseline selectors */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Compare Baselines</h3>
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted uppercase tracking-wider">Baseline A (blue)</label>
                <select
                  value={baselineAId}
                  onChange={e => setBaselineAId(e.target.value)}
                  title="Select Baseline A"
                  className="bg-surface-highlight border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="">— select —</option>
                  {baselineIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted uppercase tracking-wider">Baseline B (purple)</label>
                <select
                  value={baselineBId}
                  onChange={e => setBaselineBId(e.target.value)}
                  title="Select Baseline B"
                  className="bg-surface-highlight border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary/50"
                >
                  <option value="">— select —</option>
                  {baselineIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => window.open(getExportCsvUrl(undefined, baselineAId || undefined), '_blank')}
                  className="flex items-center gap-2 btn-ghost text-sm"
                  disabled={!baselineAId}
                >
                  <Download size={14} />
                  Export A
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          {baselineAId && baselineBId ? (
            <div className="glass-panel p-6">
              <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Average Metrics — {baselineAId} vs {baselineBId}
              </h4>
              <MetricsChart
                baselineA={baselineAData}
                baselineB={baselineBData}
                metricKeys={CHART_METRIC_KEYS}
                labelA={baselineAId}
                labelB={baselineBId}
              />
              <p className="text-xs text-text-muted mt-3">
                Delta labels on purple bars: positive (red) = B costs more, negative (green) = B is cheaper.
              </p>
            </div>
          ) : (
            <div className="glass-panel p-12 text-center text-text-muted">
              Select two baselines above to see the comparison chart.
            </div>
          )}

          {/* Diff table */}
          {baselineAId && baselineBId && (
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-surface-highlight/30 text-xs uppercase tracking-wider text-text-muted">
                    <th className="p-4 font-semibold">Metric</th>
                    <th className="p-4 font-semibold text-primary">{baselineAId}</th>
                    <th className="p-4 font-semibold text-secondary">{baselineBId}</th>
                    <th className="p-4 font-semibold">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {CHART_METRIC_KEYS.map(key => {
                    const a = baselineAData[key] ?? 0;
                    const b = baselineBData[key] ?? 0;
                    const delta = a === 0 ? null : ((b - a) / Math.abs(a)) * 100;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <tr key={key} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-text-muted">{label}</td>
                        <td className="p-4 font-mono text-primary">{a.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="p-4 font-mono text-secondary">{b.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="p-4 font-mono">
                          {delta === null ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            <span className={delta < 0 ? 'text-success' : delta > 0 ? 'text-error' : 'text-text-muted'}>
                              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          )}
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

      {/* Trends section */}
      {activeSection === 'trends' && (
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Metric Trends Over Time</h3>
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted uppercase tracking-wider">Task</label>
                <select
                  value={selectedTaskId}
                  onChange={e => setSelectedTaskId(e.target.value)}
                  title="Select Task"
                  className="bg-surface-highlight border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="">— select task —</option>
                  {taskIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted uppercase tracking-wider">Metric</label>
                <select
                  value={trendMetric}
                  onChange={e => setTrendMetric(e.target.value)}
                  title="Select Metric"
                  className="bg-surface-highlight border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                >
                  {TREND_METRIC_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!selectedTaskId}
                  className="flex items-center gap-2 btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  title={selectedTaskId ? `Export ${selectedTaskId} as CSV` : 'Select a task first'}
                >
                  <Download size={14} />
                  Export Task CSV
                </button>
              </div>
            </div>
          </div>

          {selectedTaskId ? (
            trendLoading ? (
              <div className="glass-panel p-12 text-center text-text-muted">Loading trend data...</div>
            ) : trendRuns.length === 0 ? (
              <div className="glass-panel p-12 text-center text-text-muted">No runs found for this task.</div>
            ) : (
              <div className="glass-panel p-6">
                <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                  {TREND_METRIC_OPTIONS.find(o => o.key === trendMetric)?.label ?? trendMetric} — {selectedTaskId}
                </h4>
                <p className="text-xs text-text-muted mb-4">
                  {trendRuns.length} run{trendRuns.length !== 1 ? 's' : ''} — dots colored by success (cyan) / failure (red)
                </p>
                <TrendChart runs={trendRuns} metricKey={trendMetric} />
              </div>
            )
          ) : (
            <div className="glass-panel p-12 text-center text-text-muted">Select a task above to see its trend.</div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
