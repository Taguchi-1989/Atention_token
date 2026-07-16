'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';
import {
  createHermesRun,
  fetchHermesRun,
  fetchHermesRuns,
  getHermesScreenshotUrl,
  HermesRunRequest,
} from '@/lib/api';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';

interface HermesRunSummary {
  id: number;
  status: string;
  started_at: string;
  sanitized_url: string;
  task: string;
  product_area: string;
  load_ms: number | null;
  lcp_ms: number | null;
  finding_count: number;
}

interface HermesStep {
  step_index: number;
  url: string;
  title: string;
  action: string;
  duration_ms: number;
  screenshot_path?: string | null;
  summary_json?: {
    redacted_count?: number;
    element_counts?: Record<string, number>;
    headings?: string[];
  };
}

interface HermesNetworkEntry {
  id: number;
  method: string;
  url: string;
  host: string;
  path: string;
  resource_type: string;
  status: number | null;
  duration_ms: number | null;
  body_saved: number | boolean;
  headers_saved: number | boolean;
}

interface HermesFinding {
  id: number;
  type: string;
  severity: string;
  message: string;
  evidence_json?: Record<string, unknown>;
}

interface HermesRunDetail extends HermesRunSummary {
  completed_at: string;
  profile_name: string;
  dom_content_loaded_ms: number | null;
  ttfb_ms: number | null;
  fcp_ms: number | null;
  cls: number | null;
  privacy_mode: string;
  steps: HermesStep[];
  network: HermesNetworkEntry[];
  findings: HermesFinding[];
}

const PRODUCT_OPTIONS = [
  { value: 'attention_ledger', label: 'Attention Ledger' },
  { value: 'talkbalancer', label: 'TalkBalancer' },
  { value: 'hermes', label: 'Hermes' },
];

export default function HermesPage() {
  const [runs, setRuns] = useState<HermesRunSummary[]>([]);
  const [selected, setSelected] = useState<HermesRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: '',
    task: '主要画面を開き、表示速度と壊れている通信を確認する',
    product_area: 'attention_ledger',
    profile_name: 'default',
    allow_hosts: '',
    redact_selectors: '[data-hermes-redact]\n[data-private]',
  });

  useEffect(() => {
    if (!form.url && typeof window !== 'undefined') {
      setForm((prev) => ({ ...prev, url: window.location.origin }));
    }
  }, [form.url]);

  const reload = async (selectId?: number) => {
    setLoadingRuns(true);
    try {
      const data = await fetchHermesRuns(50) as HermesRunSummary[];
      setRuns(data);
      const targetId = selectId ?? selected?.id ?? data[0]?.id;
      if (targetId) {
        const detail = await fetchHermesRun(targetId) as HermesRunDetail;
        setSelected(detail);
      } else {
        setSelected(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hermes runs could not be loaded');
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStep = selected?.steps?.[0];
  const topNetwork = useMemo(() => (selected?.network ?? []).slice(0, 8), [selected]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const payload: HermesRunRequest = {
        url: form.url.trim(),
        task: form.task.trim(),
        product_area: form.product_area,
        profile_name: form.profile_name.trim() || 'default',
        allow_hosts: splitLines(form.allow_hosts),
        redact_selectors: splitLines(form.redact_selectors),
        max_steps: 1,
        save_screenshots: true,
        capture_network: true,
        capture_web_vitals: true,
      };
      const result = await createHermesRun(payload) as HermesRunDetail;
      await reload(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hermes run failed');
    } finally {
      setRunning(false);
    }
  };

  const loadDetail = async (runId: number) => {
    setError(null);
    try {
      const detail = await fetchHermesRun(runId) as HermesRunDetail;
      setSelected(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hermes run could not be loaded');
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck size={14} /> Privacy-safe audit memory
          </div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Hermes
          </h2>
          <p className="mt-2 max-w-3xl text-text-muted">
            Attention Ledger と同じ実行基盤で、個人環境のページ表示・通信・黒塗りスクショを保存します。
            Cookie、Authorization、本文、request/response body は保存しません。
          </p>
        </div>
        <button type="button" onClick={() => reload()} className="btn-ghost inline-flex items-center gap-2 text-sm">
          <RefreshCw size={15} /> 更新
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="glass-panel p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Activity size={18} className="text-primary" /> 監査を実行
          </h3>
          <div className="space-y-4">
            <Field label="URL">
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="http://localhost:3000"
              />
            </Field>
            <Field label="対象">
              <select
                value={form.product_area}
                onChange={(e) => setForm({ ...form, product_area: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {PRODUCT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="タスク">
              <textarea
                value={form.task}
                onChange={(e) => setForm({ ...form, task: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="プロファイル">
                <input
                  value={form.profile_name}
                  onChange={(e) => setForm({ ...form, profile_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="追加host">
                <input
                  value={form.allow_hosts}
                  onChange={(e) => setForm({ ...form, allow_hosts: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="api.example.com"
                />
              </Field>
            </div>
            <Field label="黒塗りselector">
              <textarea
                value={form.redact_selectors}
                onChange={(e) => setForm({ ...form, redact_selectors: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
              />
            </Field>
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !form.url.trim() || !form.task.trim()}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {running ? '監査中...' : 'Hermes監査を実行'}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={<Clock size={18} />} label="Load" value={ms(selected?.load_ms)} />
            <MetricCard icon={<Activity size={18} />} label="LCP" value={ms(selected?.lcp_ms)} />
            <MetricCard icon={<Network size={18} />} label="Requests" value={String(selected?.network?.length ?? 0)} />
            <MetricCard icon={<AlertTriangle size={18} />} label="Findings" value={String(selected?.findings?.length ?? 0)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            <div className="glass-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Camera size={18} className="text-primary" /> 証跡
                </h3>
                {selected && (
                  <span className="text-xs text-text-muted">
                    {selected.privacy_mode}
                  </span>
                )}
              </div>
              {selected && selectedStep?.screenshot_path ? (
                <div className="space-y-4 p-4">
                  <Image
                    src={getHermesScreenshotUrl(selected.id, selectedStep.step_index)}
                    alt="Hermes redacted screenshot"
                    width={1280}
                    height={720}
                    unoptimized
                    className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                  />
                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <Info label="Title" value={selectedStep.title || '-'} />
                    <Info label="Redacted" value={String(selectedStep.summary_json?.redacted_count ?? 0)} />
                    <Info label="Duration" value={ms(selectedStep.duration_ms)} />
                  </div>
                </div>
              ) : (
                <EmptyState loading={loadingRuns} />
              )}
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="border-b border-white/5 p-4">
                <h3 className="font-semibold">Hermes Memory</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => loadDetail(run.id)}
                    className={clsx(
                      'block w-full p-4 text-left transition-colors hover:bg-white/5',
                      selected?.id === run.id && 'bg-primary/10'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-text-muted">
                        {run.product_area}
                      </span>
                      <StatusBadge status={run.status} count={run.finding_count} />
                    </div>
                    <p className="truncate text-sm font-semibold text-white">{run.task}</p>
                    <p className="mt-1 truncate text-xs text-text-muted">{run.sanitized_url}</p>
                    <p className="mt-2 text-xs text-text-muted">{new Date(run.started_at).toLocaleString()}</p>
                  </button>
                ))}
                {!loadingRuns && runs.length === 0 && (
                  <div className="p-6 text-center text-sm text-text-muted">Hermes run はまだありません。</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Findings" icon={<AlertTriangle size={18} className="text-warning" />}>
              {selected?.findings?.length ? (
                <div className="space-y-3">
                  {selected.findings.map((finding) => (
                    <div key={finding.id} className="rounded-lg border border-white/10 bg-background/50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={clsx(
                          'h-2 w-2 rounded-full',
                          finding.severity === 'high' ? 'bg-error' : finding.severity === 'medium' ? 'bg-warning' : 'bg-primary'
                        )} />
                        <span className="text-sm font-semibold">{finding.type}</span>
                        <span className="text-xs text-text-muted">{finding.severity}</span>
                      </div>
                      <p className="text-sm text-text-muted">{finding.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">選択中のrunにfindingはありません。</p>
              )}
            </Panel>

            <Panel title="Network Metadata" icon={<Network size={18} className="text-primary" />}>
              {topNetwork.length ? (
                <div className="space-y-2">
                  {topNetwork.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[58px_1fr_70px] gap-3 rounded-lg border border-white/10 bg-background/50 p-3 text-sm">
                      <span className="font-mono text-primary">{entry.method}</span>
                      <span className="truncate text-text-muted">{entry.path}</span>
                      <span className="text-right font-mono">{ms(entry.duration_ms)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">通信メタデータはありません。</p>
              )}
            </Panel>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between text-text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-4">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/50 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex min-h-[340px] items-center justify-center p-6 text-center text-sm text-text-muted">
      {loading ? '読み込み中...' : '監査を実行すると黒塗り済みスクショが表示されます。'}
    </div>
  );
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  if (status === 'completed' && count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CheckCircle2 size={13} /> clean
      </span>
    );
  }
  return (
    <span className={clsx('text-xs', status === 'error' ? 'text-error' : count > 0 ? 'text-warning' : 'text-text-muted')}>
      {status === 'error' ? 'error' : `${count} findings`}
    </span>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ms(value?: number | null): string {
  if (value == null) return '-';
  return `${Math.round(value)}ms`;
}
