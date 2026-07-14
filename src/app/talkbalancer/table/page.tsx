'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Wine, Settings2, Mic, MicOff, Volume2, Gauge, Activity, HandHeart } from 'lucide-react';
import TalkBalancerSpeakerPie from '@/components/TalkBalancerSpeakerPie';
import { useTalkBalancerNoiseMeter } from '@/hooks/useTalkBalancerNoiseMeter';
import { rmsToRelativeLevel } from '@/lib/talkbalancer-mic';
import {
  fetchTbSession, fetchTbAlerts, isDemoMode,
  fetchTbSpeakerStats,
  TbSession, TbAlert, TbSpeakerStats, NOISE_LABELS,
} from '@/lib/talkbalancer';

const POLL_MS = 2000;
const ALERT_SHOW_MS = 25000;
const SPEAKER_POLL_MS = 5000;
const FACILITATION_GRACE_MS = 20 * 60 * 1000;

const MODE_LABELS: Record<string, string> = {
  volume_only: '解析モード：A（音量のみ）',
  balance: '解析モード：B（音量＋発話バランス）',
  transcript: '解析モード：C（文字起こしあり）',
};

function buildFacilitationCue(stats: TbSpeakerStats | null, session: TbSession | null) {
  if (!session) return null;
  const startedAt = new Date(session.startedAt).getTime();
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < FACILITATION_GRACE_MS) return null;
  if (!stats || stats.totalSeconds < 30) return null;

  const dominant = stats.total.find((item) => item.share > 0.5);
  if (!dominant) return null;

  const quiet = stats.total
    .filter((item) => item.participantId !== dominant.participantId)
    .sort((a, b) => a.seconds - b.seconds)[0];

  const silentPeople = stats.total.filter((item) => item.seconds === 0);
  const share = Math.round(dominant.share * 100);

  if (silentPeople.length > 0) {
    return {
      title: '話を振るタイミングです',
      message: `${dominant.name}の発話が全体の${share}%です。まだ話せていない人がいるので、一度ほかの人へ振ると場が広がりそうです。`,
      action: `${silentPeople[0].name}に「最近どうですか？」と振ってみましょう。`,
      tone: 'warning',
    };
  }

  if (quiet && dominant.seconds >= quiet.seconds * 2) {
    return {
      title: '会話を回す合図です',
      message: `${dominant.name}の発話が全体の${share}%です。${quiet.name}にも話す余地を作ると、バランスが整いそうです。`,
      action: `${quiet.name}に短く感想を聞いてみましょう。`,
      tone: 'primary',
    };
  }

  return {
    title: '少し偏りがあります',
    message: `${dominant.name}の発話が全体の${share}%です。ここで一度、別の人にも話題を渡すとよさそうです。`,
    action: '近くの人へ「どう思いますか？」と振ってみましょう。',
    tone: 'primary',
  };
}

// F-04 テーブル表示モード ＋ F-06 丁重アラート ＋ Step 3/4 騒音・会話密度メーター
export default function TableDisplayPage() {
  const [session, setSession] = useState<TbSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [alert, setAlert] = useState<TbAlert | null>(null);
  const [speakerStats, setSpeakerStats] = useState<TbSpeakerStats | null>(null);
  const [demo, setDemo] = useState(false);
  const {
    activeMic,
    analysis,
    error: micError,
    measuring,
    start: startMeasure,
    stop: stopMeasure,
  } = useTalkBalancerNoiseMeter();

  const seqRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 画面を常時表示に保つ（Screen Wake Lock）
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock) lock = await nav.wakeLock.request('screen');
      } catch {
        // 非対応ブラウザや省電力設定では取得できないが、表示自体は継続する
      }
    };
    request();
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    const loadStats = async () => {
      try {
        const stats = await fetchTbSpeakerStats();
        if (!stopped) setSpeakerStats(stats);
      } catch {
        // 話者記録は補助表示なので一時的な失敗は次回更新に任せる
      }
    };
    loadStats();
    const id = setInterval(loadStats, SPEAKER_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  // セッション状態の取得とアラートのポーリング
  useEffect(() => {
    let stopped = false;

    const init = async () => {
      try {
        const s = await fetchTbSession();
        if (stopped) return;
        setSession(s.session);
        setDemo(isDemoMode());
        seqRef.current = s.seq; // 起動前の過去アラートは表示しない
      } catch {
        if (!stopped) setSession(null);
      } finally {
        if (!stopped) setChecked(true);
      }
    };

    const poll = async () => {
      try {
        const res = await fetchTbAlerts(seqRef.current);
        if (stopped) return;
        if (!res.active) { setSession(null); return; }
        if (res.alerts.length > 0) {
          const latest = res.alerts[res.alerts.length - 1];
          seqRef.current = res.seq;
          setAlert(latest);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setAlert(null), ALERT_SHOW_MS);
        }
      } catch {
        // 一時的な接続断はスキップして次のポーリングに任せる
      }
    };

    init();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (checked && !session) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-6 text-center">
        <Wine size={48} className="text-text-muted" />
        <p className="text-xl text-text-muted">セッションが開始されていません。</p>
        <Link
          href="/talkbalancer/declaration"
          className="rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-black"
        >
          開始前宣言から始める
        </Link>
      </div>
    );
  }

  const isNotice = alert?.severity !== 'info';
  const noiseTone =
    analysis?.noiseCategory === 'very_loud' ? 'text-error'
    : analysis?.noiseCategory === 'loud' ? 'text-warning'
    : 'text-success';
  const balanceEnabled = session?.mode === 'balance' || session?.mode === 'transcript';
  const facilitationCue = buildFacilitationCue(speakerStats, session);

  return (
    <div className="min-h-screen bg-background text-white flex flex-col p-6 select-none">
      {/* ヘッダー：会名と解析モード */}
      <header className="flex items-center justify-between text-sm text-text-muted">
        <span className="inline-flex items-center gap-2">
          <Wine size={18} className="text-primary" />
          <span className="font-semibold text-white">{session?.title ?? 'TalkBalancer'}</span>
          {demo && (
            <span className="rounded-full border border-secondary/60 bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
              デモモード
            </span>
          )}
        </span>
        <span>{session ? MODE_LABELS[session.mode] : ''}</span>
      </header>

      {/* メイン：丁重アラート or 平常時メッセージ */}
      <main className="flex-1 flex items-center justify-center">
        {alert ? (
          <div
            className={`max-w-3xl rounded-3xl border p-10 sm:p-14 text-center shadow-glow transition-all ${
              isNotice ? 'border-warning/60 bg-warning/5' : 'border-primary/60 bg-primary/5'
            }`}
          >
            <p className="whitespace-pre-line text-2xl sm:text-4xl font-semibold leading-relaxed">
              {alert.message}
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-3xl sm:text-5xl font-bold text-text-muted/70">
              いい場になっています 🍻
            </p>
            <p className="text-text-muted">TalkBalancer が見守り中です</p>
          </div>
        )}
      </main>

      {speakerStats && speakerStats.participants.length > 0 && balanceEnabled && (
        <section className="mb-4 space-y-3">
          {facilitationCue && (
            <div className={`rounded-xl border p-4 ${
              facilitationCue.tone === 'warning'
                ? 'border-warning/50 bg-warning/10'
                : 'border-primary/50 bg-primary/10'
            }`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <HandHeart size={17} className={facilitationCue.tone === 'warning' ? 'text-warning' : 'text-primary'} />
                    {facilitationCue.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{facilitationCue.message}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm font-medium text-white">
                  {facilitationCue.action}
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <TalkBalancerSpeakerPie
              title="話者バランス（全体）"
              data={speakerStats.total}
              totalSeconds={speakerStats.totalSeconds}
            />
            <TalkBalancerSpeakerPie
              title="話者バランス（直近5分）"
              data={speakerStats.recent5m}
              totalSeconds={speakerStats.recent5mSeconds}
            />
          </div>
        </section>
      )}

      {/* Step 4: 騒音・会話密度メーター（F-04 表示項目） */}
      <section className="mb-4">
        {measuring && analysis ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Meter
              icon={<Volume2 size={16} />}
              label="店内音量（相対値）"
              value={(
                <span className={noiseTone}>
                  {NOISE_LABELS[analysis.noiseCategory]}
                  <span className="mt-1 block font-mono text-xs text-text-muted">
                    {rmsToRelativeLevel(analysis.noiseLevel)}/100 ・ {analysis.noiseDb.toFixed(1)} dBFS
                  </span>
                </span>
              )}
              bar={Math.min(1, analysis.noiseLevel / 0.25)}
              barClass={analysis.noiseCategory === 'loud' || analysis.noiseCategory === 'very_loud' ? 'bg-warning' : 'bg-primary'}
            />
            <Meter
              icon={<Gauge size={16} />}
              label="会話しやすさ"
              value={<>{analysis.comfortScore}<span className="text-sm text-text-muted">点</span></>}
              bar={analysis.comfortScore / 100}
              barClass="bg-gradient-to-r from-primary to-success"
            />
            <Meter
              icon={<Activity size={16} />}
              label="会話密度（1分）"
              value={<>{Math.round(analysis.speechDensity1m * 100)}<span className="text-sm text-text-muted">%</span></>}
              bar={analysis.speechDensity1m}
              barClass="bg-secondary"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              onClick={startMeasure}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-5 py-3 text-primary hover:bg-primary/20"
            >
              <Mic size={16} /> 騒音メーターを開始（録音はしません）
            </button>
            {micError && <span className="text-error">{micError}</span>}
          </div>
        )}
        {measuring && activeMic && (
          <div className={`mt-2 rounded-lg border px-3 py-2 text-center text-xs ${
            activeMic.isExternal
              ? 'border-primary/30 bg-primary/5 text-text-muted'
              : 'border-warning/40 bg-warning/10 text-warning'
          }`}>
            {activeMic.isExternal ? '外部マイク' : '内蔵マイク簡易モード'}：{activeMic.label}
            {!activeMic.isExternal && ' ／ 数値は絶対騒音dBではなく、同じPC・同じ配置で比較する参考値です。'}
          </div>
        )}
        {measuring && (
          <div className="mt-2 text-center">
            <button onClick={stopMeasure} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-white">
              <MicOff size={12} /> 計測を停止
            </button>
          </div>
        )}
      </section>

      {/* フッター：プライバシー表示（10.1 常時表示） */}
      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-text-muted">
        <span className="font-mono">
          録音保存：OFF ／ 文字起こし：{session?.mode === 'transcript' ? 'ON（保存なし）' : 'OFF'} ／ クラウド送信：OFF
        </span>
        <Link href="/talkbalancer/report" className="inline-flex items-center gap-1 hover:text-white">
          <Activity size={14} /> レポート
        </Link>
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 hover:text-white">
          <Settings2 size={14} /> 管理
        </Link>
      </footer>
    </div>
  );
}

function Meter({ icon, label, value, bar, barClass }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  bar: number;
  barClass: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
      <p className="inline-flex items-center gap-1 text-xs text-text-muted">{icon} {label}</p>
      <p className="text-xl font-bold">{value}</p>
      <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-500 ${barClass}`} style={{ width: `${Math.round(bar * 100)}%` }} />
      </div>
    </div>
  );
}
