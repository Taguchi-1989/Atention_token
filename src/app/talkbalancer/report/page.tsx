'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BarChart3, Clock, FileText, Gauge, ListChecks, ShieldCheck, Trash2,
} from 'lucide-react';
import {
  endTbSession, fetchTbReport, isDemoMode, NOISE_LABELS, REMOTE_BUTTONS,
  AlertType, TbReport,
} from '@/lib/talkbalancer';
import TalkBalancerSpeakerPie from '@/components/TalkBalancerSpeakerPie';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';
import { TalkBalancerTranscriptFeed } from '@/components/talkbalancer/TalkBalancerTranscriptFeed';

const MODE_LABELS: Record<string, string> = {
  volume_only: 'モードA：音量のみ',
  balance: 'モードB：音量＋発話バランス',
  transcript: 'モードC：ローカル文字起こし＋自動話者',
};

const ALERT_LABELS = REMOTE_BUTTONS.reduce((acc, item) => {
  acc[item.type] = item.label;
  return acc;
}, {} as Record<AlertType, string>);

export default function TalkBalancerReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<TbReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    fetchTbReport()
      .then((r) => {
        setReport(r);
        setDemo(isDemoMode());
      })
      .catch(() => setError('レポートを取得できませんでした。サーバー接続を確認してください。'));
  }, []);

  const topAlerts = useMemo(() => {
    if (!report?.alertCounts) return [];
    return Object.entries(report.alertCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as [AlertType, number][];
  }, [report]);

  const handleEnd = async () => {
    setDeleting(true);
    setError(null);
    try {
      await endTbSession();
      router.push('/talkbalancer');
    } catch {
      setDeleting(false);
      setConfirmingEnd(false);
      setError('セッションを終了できませんでした。サーバー接続を確認してください。');
    }
  };

  if (error) {
    return (
      <Shell>
        <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-error">{error}</p>
      </Shell>
    );
  }

  if (!report) {
    return (
      <Shell>
        <p className="text-text-muted">読み込み中...</p>
      </Shell>
    );
  }

  if (!report.active || !report.session) {
    return (
      <Shell>
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 text-warning">
          開催中のセッションがありません。
          <Link href="/talkbalancer/declaration" className="ml-2 underline">開始前宣言から始めてください。</Link>
        </div>
      </Shell>
    );
  }

  const analysis = report.analysis;

  return (
    <Shell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm tracking-widest text-primary">TalkBalancer Report</p>
          <h1 className="mt-2 text-3xl font-bold">{report.session.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {MODE_LABELS[report.session.mode]} ／ {formatDate(report.session.startedAt)}
            {demo ? ' ／ デモモード' : ''}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {!confirmingEnd ? (
            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-error/50 px-4 py-3 text-sm font-semibold text-error hover:bg-error/10"
            >
              <Trash2 size={16} /> 終了して削除
            </button>
          ) : (
            <div role="alert" className="rounded-xl border border-error/50 bg-error/10 p-3">
              <p className="mb-2 text-sm text-error">アラート・発話記録・メモ・騒音データを削除します。</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingEnd(false)}
                  disabled={deleting}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-white disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleEnd}
                  disabled={deleting}
                  className="rounded-lg bg-error px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {deleting ? '削除中...' : '削除を確定'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Clock size={18} />} label="経過時間" value={formatDuration(report.durationSec ?? 0)} />
        <SummaryCard icon={<ListChecks size={18} />} label="アラート合計" value={`${report.totalAlerts ?? 0}件`} />
        <SummaryCard icon={<Gauge size={18} />} label="会話しやすさ" value={`${analysis?.comfortScore ?? 100}点`} />
        <SummaryCard
          icon={<BarChart3 size={18} />}
          label="店内音量"
          value={analysis ? NOISE_LABELS[analysis.noiseCategory] : '未計測'}
        />
      </div>

      <p className="text-xs text-text-muted">
        ※ F-04 の会話バランススコア・話しすぎ/沈黙傾向・話題ループ候補は話者分離（F-09）の実装後に追加予定です。現在は騒音と沈黙から算出する「会話しやすさ」で代替しています。
      </p>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 size={18} className="text-primary" /> アラート内訳
        </h2>
        {topAlerts.length > 0 ? (
          <div className="space-y-3">
            {topAlerts.map(([type, count]) => (
              <div key={type}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{ALERT_LABELS[type]}</span>
                  <span className="font-mono text-text-muted">{count}件</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${Math.max(8, Math.round((count / Math.max(1, report.totalAlerts ?? 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">まだアラートはありません。</p>
        )}
      </section>

      {report.speakerStats && report.speakerStats.participants.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2">
          <TalkBalancerSpeakerPie
            title="話者バランス（全体）"
            data={report.speakerStats.total}
            totalSeconds={report.speakerStats.totalSeconds}
          />
          <TalkBalancerSpeakerPie
            title="話者バランス（直近5分）"
            data={report.speakerStats.recent5m}
            totalSeconds={report.speakerStats.recent5mSeconds}
          />
        </section>
      )}

      {report.session.mode === 'transcript' && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-primary" /> 文字起こし・会話解析
          </h2>
          <TalkBalancerTranscriptFeed notes={report.transcriptNotes ?? []} />
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ListChecks size={18} className="text-primary" /> 直近の表示
        </h2>
        {report.latestAlerts && report.latestAlerts.length > 0 ? (
          <div className="space-y-3">
            {report.latestAlerts.slice().reverse().map((alert) => (
              <div key={alert.seq} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-muted">
                  <span>{ALERT_LABELS[alert.type]} ／ {alert.source === 'auto' ? '自動' : '手動'}</span>
                  <span>{formatTime(alert.timestamp)}</span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed">{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">まだテーブル画面に表示されたアラートはありません。</p>
        )}
      </section>

      <section className="rounded-xl border border-success/30 bg-success/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-success">
          <ShieldCheck size={18} /> プライバシー状態
        </h2>
        <PrivacyBar privacy={report.privacy ?? undefined} mode={report.session.mode} />
        <p className="mt-3 text-xs text-text-muted">
          このレポートは開催中セッションのメモリ状態から生成されています。終了するとアラートとメトリクスは削除されます。
        </p>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-5 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-2 flex items-center gap-2 text-xs text-text-muted">{icon} {label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
