'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Gauge,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Send,
  Settings2,
  Smartphone,
  Users,
  Volume2,
  Wine,
} from 'lucide-react';
import TalkBalancerSpeakerPie from '@/components/TalkBalancerSpeakerPie';
import { TalkBalancerTranscriptFeed } from '@/components/talkbalancer/TalkBalancerTranscriptFeed';
import { useTalkBalancerNoiseMeter } from '@/hooks/useTalkBalancerNoiseMeter';
import { rmsToRelativeLevel } from '@/lib/talkbalancer-mic';
import {
  AlertType,
  fetchTbAlerts,
  fetchTbSession,
  fetchTbSpeakerStats,
  fetchTbTranscriptNotes,
  isDemoMode,
  NOISE_LABELS,
  recordTbSpeakerBatch,
  REMOTE_BUTTONS,
  sendTbAlert,
  TbAlert,
  TbSession,
  TbSpeakerStats,
  TbTranscriptNote,
} from '@/lib/talkbalancer';

const ALERT_POLL_MS = 2000;
const STATS_POLL_MS = 5000;
const ALERT_SHOW_MS = 25000;
const PRESENTATION_HIDE_MS = 5000;

function transcriptionStateLabel(state?: string): string {
  return ({
    off: '停止中',
    starting: 'モデル準備中',
    listening: '文字起こし中',
    processing: '音声を処理中',
    unavailable: 'モデル未導入',
    error: '確認が必要',
  } as Record<string, string>)[state ?? 'off'] ?? '停止中';
}

function publicBalanceMessage(stats: TbSpeakerStats | null): string {
  if (!stats || stats.totalSeconds === 0) return '発話記録はまだありません';
  const maximum = Math.max(...stats.total.map((person) => person.share));
  return maximum >= 0.55
    ? '少し一人に話が集まっています。別の人にも話を振ってみましょう。'
    : 'いまのところ、会話はおおむねバランスよく進んでいます。';
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function MobileOneDevicePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [session, setSession] = useState<TbSession | null>(null);
  const [speakerStats, setSpeakerStats] = useState<TbSpeakerStats | null>(null);
  const [transcriptNotes, setTranscriptNotes] = useState<TbTranscriptNote[]>([]);
  const [alert, setAlert] = useState<TbAlert | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sending, setSending] = useState<AlertType | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(15);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [demo, setDemo] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const seqRef = useRef(0);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    activeMic,
    analysis,
    error: micError,
    measuring,
    measuringElsewhere,
    transcription,
    start: startMeasure,
    stop: stopMeasure,
  } = useTalkBalancerNoiseMeter({ transcriptionEnabled: session?.mode === 'transcript' });

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  useEffect(() => {
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    if (!presentationMode || controlsOpen) {
      setChromeVisible(true);
      return;
    }
    chromeTimerRef.current = setTimeout(() => setChromeVisible(false), PRESENTATION_HIDE_MS);
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, [presentationMode, controlsOpen, chromeVisible]);

  useEffect(() => {
    let stopped = false;
    const loadSession = async () => {
      try {
        const state = await fetchTbSession();
        if (stopped) return;
        setSession(state.session);
        seqRef.current = state.seq;
        setDemo(isDemoMode());
      } catch {
        if (!stopped) setSession(null);
      } finally {
        if (!stopped) setChecked(true);
      }
    };
    loadSession();
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false;

    const loadStats = async () => {
      try {
        const [stats, notesResult] = await Promise.all([
          fetchTbSpeakerStats(),
          session.mode === 'transcript' ? fetchTbTranscriptNotes() : Promise.resolve(null),
        ]);
        if (!stopped) {
          setSpeakerStats(stats);
          if (notesResult) setTranscriptNotes(notesResult.notes);
        }
      } catch {
        // 補助表示は次回更新に任せる。
      }
    };
    const pollAlerts = async () => {
      try {
        const result = await fetchTbAlerts(seqRef.current);
        if (stopped || !result.active) return;
        if (result.alerts.length > 0) {
          const latest = result.alerts[result.alerts.length - 1];
          seqRef.current = result.seq;
          setAlert(latest);
          if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
          alertTimerRef.current = setTimeout(() => setAlert(null), ALERT_SHOW_MS);
        }
      } catch {
        // 一時的な接続断は次回更新に任せる。
      }
    };

    loadStats();
    const statsTimer = setInterval(loadStats, STATS_POLL_MS);
    const alertTimer = setInterval(pollAlerts, ALERT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(statsTimer);
      clearInterval(alertTimer);
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, [session]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock) lock = await nav.wakeLock.request('screen');
      } catch {
        // 省電力設定などで取得できなくても利用は継続できる。
      }
    };
    request();
    return () => { lock?.release().catch(() => {}); };
  }, []);

  const beginOneDeviceFlow = () => {
    window.localStorage.setItem('talkbalancer.startTarget', 'mobile');
    window.localStorage.setItem('talkbalancer.startTargetAt', String(Date.now()));
    router.push('/talkbalancer/declaration');
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const revealChrome = () => {
    if (!presentationMode || chromeVisible) return;
    setChromeVisible(true);
  };

  const togglePresentationMode = async () => {
    if (presentationMode) {
      setPresentationMode(false);
      setChromeVisible(true);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }

    setPresentationMode(true);
    setChromeVisible(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {
        // iOSなどFullscreen API非対応でも、アプリ内UIの自動非表示は利用する。
      });
    }
  };

  const showSent = (label: string) => {
    setSent(label);
    setTimeout(() => setSent(null), 2500);
  };

  const handleSend = async (type: AlertType, label: string) => {
    setSending(type);
    setError(null);
    try {
      const nextAlert = await sendTbAlert(type);
      setAlert(nextAlert);
      seqRef.current = Math.max(seqRef.current, nextAlert.seq);
      setControlsOpen(false);
      showSent(label);
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlert(null), ALERT_SHOW_MS);
    } catch {
      setError('通知を表示できませんでした。');
    } finally {
      setSending(null);
    }
  };

  const addPending = (participantId: string) => {
    setPending((previous) => ({
      ...previous,
      [participantId]: (previous[participantId] ?? 0) + durationSec,
    }));
  };

  const flushSpeakers = async () => {
    const events = Object.entries(pending)
      .filter(([, seconds]) => seconds > 0)
      .map(([participantId, seconds]) => ({ participantId, durationSec: seconds }));
    if (events.length === 0) return;
    setError(null);
    try {
      const result = await recordTbSpeakerBatch(events);
      setSpeakerStats(result.stats);
      setPending({});
      showSent('話者バランス');
    } catch {
      setError('話者記録を反映できませんでした。');
    }
  };

  if (!checked) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-white">
        <div className="mx-auto max-w-md space-y-6">
          <Link href="/talkbalancer" className="text-sm text-text-muted hover:text-white">← TalkBalancer</Link>
          <div className="rounded-3xl border border-primary/40 bg-gradient-to-b from-primary/15 to-surface p-6 text-center shadow-glow">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-black">
              <Smartphone size={32} />
            </div>
            <h1 className="mt-5 text-3xl font-bold">携帯1台モード</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Android携帯をテーブルに置き、内蔵マイク・テーブル表示・幹事操作を1画面で使います。
            </p>
          </div>
          <div className="grid gap-3">
            {[
              ['1', '開始前宣言と同意', '全員にルールを見せてから開始します。'],
              ['2', '携帯の内蔵マイク', '相対音量を計測し、音声は保存しません。'],
              ['3', '下部の操作パネル', '必要なときだけ開き、丁寧な通知を表示します。'],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-black">{number}</span>
                <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-text-muted">{description}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 text-sm leading-relaxed text-text-muted">
            <p><span className="font-semibold text-white">スマホだけ：</span>音量・通知・手動バランス</p>
            <p className="mt-1"><span className="font-semibold text-white">PCも併用：</span>ローカル文字起こし・話者識別</p>
            <p className="mt-1 text-xs">外付けマイクはどちらも必須ではありません。</p>
          </div>
          <button onClick={beginOneDeviceFlow} className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-4 font-semibold text-black">
            携帯1台で開始する
          </button>
          {installPrompt ? (
            <button onClick={install} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 px-5 py-3 text-primary">
              <Download size={17} /> ホーム画面に追加
            </button>
          ) : (
            <p className="text-center text-xs text-text-muted">Android Chromeのメニューから「ホーム画面に追加」も利用できます。</p>
          )}
        </div>
      </main>
    );
  }

  const balanceEnabled = session.mode === 'balance' || session.mode === 'transcript';
  const pendingTotal = Object.values(pending).reduce((sum, value) => sum + value, 0);
  const noiseTone = analysis?.noiseCategory === 'very_loud'
    ? 'text-error'
    : analysis?.noiseCategory === 'loud' ? 'text-warning' : 'text-success';

  return (
    <main
      className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] text-white"
      onPointerDown={revealChrome}
    >
      {(!presentationMode || chromeVisible) && <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><Wine size={17} className="text-primary" /> {session.title}</span>
        <span className="flex items-center gap-2 text-xs text-text-muted">
          {demo && <span className="rounded-full border border-secondary/50 px-2 py-0.5 text-secondary">デモ</span>}
          <button
            onClick={togglePresentationMode}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-white hover:border-primary/50"
          >
            <Maximize2 size={13} /> 表示専用
          </button>
        </span>
      </header>}

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <section className={`flex min-h-52 items-center justify-center rounded-3xl border p-6 text-center shadow-glow ${
          alert ? 'border-primary/60 bg-primary/10' : 'border-border bg-surface'
        }`}>
          {alert ? (
            <div>
              <p className="whitespace-pre-line text-2xl font-semibold leading-relaxed">{alert.message}</p>
              <p className="mt-4 text-xs text-text-muted">個人名と送信者は表示されません</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-text-muted/80">いい場になっています 🍻</p>
              <p className="mt-3 text-sm text-text-muted">携帯をテーブル中央寄りに置いてください</p>
            </div>
          )}
        </section>

        {measuring && analysis ? (
          <section className="grid grid-cols-3 gap-2">
            <MobileMetric icon={<Volume2 size={15} />} label="相対音量" value={`${rmsToRelativeLevel(analysis.noiseLevel)}/100`} detail={NOISE_LABELS[analysis.noiseCategory]} tone={noiseTone} />
            <MobileMetric icon={<Gauge size={15} />} label="入力値" value={`${analysis.noiseDb.toFixed(1)}`} detail="dBFS参考値" />
            <MobileMetric icon={<Activity size={15} />} label="会話密度" value={`${Math.round(analysis.speechDensity1m * 100)}%`} detail="直近1分" />
          </section>
        ) : (
          <button onClick={startMeasure} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-5 py-4 font-semibold text-primary">
            <Mic size={18} /> {measuringElsewhere
              ? '別画面で計測中・この携帯へ切替'
              : session.mode === 'transcript' ? 'マイク計測＋文字起こし開始' : '携帯のマイクで計測開始'}
          </button>
        )}

        {measuring && (
          <section className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-text-muted">
            <p className="text-warning">{activeMic?.isExternal ? '外部マイク' : '携帯内蔵マイク簡易モード'}：{activeMic?.label}</p>
            <p className="mt-1">数値は絶対騒音dBではなく、この携帯・この配置で比較する目安です。</p>
            <button onClick={stopMeasure} className="mt-2 inline-flex items-center gap-1 text-white"><MicOff size={13} /> 計測停止</button>
          </section>
        )}
        {micError && <p className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{micError}</p>}

        {session.mode === 'transcript' && (
          <section className="rounded-xl border border-secondary/30 bg-secondary/5 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold"><FileText size={15} className="text-secondary" />文字起こし</span>
              <span className="text-xs text-text-muted">{transcriptionStateLabel(transcription?.state)}</span>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {transcription?.currentSpeakerKey ? '発話を検知中です。話者名と本文は幹事操作内だけに表示します。' : '録音保存せず、自宅PCのメモリ上で短い音声断片を処理します。'}
            </p>
          </section>
        )}

        {balanceEnabled && speakerStats && speakerStats.participants.length > 0 && (
          <section className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-semibold text-text-muted">会話バランス</p>
            <p className="mt-2 text-sm leading-relaxed">{publicBalanceMessage(speakerStats)}</p>
            <p className="mt-2 text-[10px] text-text-muted">個人名と割合は幹事操作の中だけに表示します。</p>
          </section>
        )}

        <div className="flex justify-between text-xs text-text-muted">
          <span>録音保存 OFF ／ クラウド送信 OFF{session.mode === 'transcript' ? ' ／ PC一時処理 ON' : ''}</span>
          <Link href="/talkbalancer/report" className="inline-flex items-center gap-1 hover:text-white"><Activity size={13} /> レポート</Link>
        </div>
      </div>

      {(!presentationMode || chromeVisible || controlsOpen) && <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
        {controlsOpen && (
          <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-3xl border border-primary/40 bg-surface p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 font-semibold"><Settings2 size={18} className="text-primary" /> 幹事操作</h2>
              <button onClick={() => setControlsOpen(false)} className="rounded-lg border border-border p-2"><ChevronDown size={18} /></button>
            </div>

            {session.mode === 'transcript' && (
              <section className="mb-5 rounded-xl border border-secondary/30 bg-background p-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-secondary" />自動文字起こし</p>
                <p className="mt-2 text-sm">
                  現在：<span className="font-semibold text-secondary">{transcription?.currentSpeakerName ?? '発話待ち'}</span>
                  {transcription?.currentSpeakerKey && !transcription.currentParticipantId && '（未対応）'}
                </p>
                <p className="mt-1 text-xs text-text-muted">{transcriptionStateLabel(transcription?.state)} ／ 音声保存なし</p>
                {transcription?.currentSpeakerKey && <p className="mt-1 text-[11px] text-text-muted">約3秒ごとに自動切替 ／ 推定確信度 {Math.round(transcription.currentSpeakerConfidence * 100)}%</p>}
                {transcription?.error && <p className="mt-2 text-xs text-warning">{transcription.error}</p>}
                {transcription?.clusters.some((cluster) => !cluster.participantId) && (
                  <p className="mt-2 text-xs text-text-muted">未対応の「話者1」などは、幹事リモコンで参加者名に一度対応づけると以後自動で切り替わります。</p>
                )}
                <div className="mt-3">
                  <TalkBalancerTranscriptFeed notes={transcriptNotes} status={transcription} live compact />
                </div>
              </section>
            )}

            {balanceEnabled && speakerStats && speakerStats.participants.length > 0 && (
              <section className="mb-5 space-y-3">
                <TalkBalancerSpeakerPie title="話者バランス（幹事のみ）" data={speakerStats.total} totalSeconds={speakerStats.totalSeconds} />
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" /> いま話していた人</p>
                  <select value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} className="rounded-lg border border-border bg-background px-2 py-2 text-xs">
                    <option value={5}>+5秒</option><option value={15}>+15秒</option><option value={30}>+30秒</option><option value={60}>+60秒</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {speakerStats.participants.map((participant) => (
                    <button key={participant.id} onClick={() => addPending(participant.id)} className="rounded-xl border border-border bg-background p-3 text-left active:scale-95">
                      <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: participant.color }} />{participant.name}</span>
                      <span className="mt-1 block text-xs text-text-muted">未反映 {pending[participant.id] ?? 0}秒</span>
                    </button>
                  ))}
                </div>
                <button onClick={flushSpeakers} disabled={pendingTotal === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"><Send size={15} /> まとめて反映（{pendingTotal}秒）</button>
              </section>
            )}

            <p className="mb-2 text-sm font-semibold">丁寧な通知</p>
            <div className="grid grid-cols-3 gap-2">
              {REMOTE_BUTTONS.map((button) => (
                <button key={button.type} onClick={() => handleSend(button.type, button.label)} disabled={sending !== null} className="rounded-xl border border-border bg-background p-3 text-center active:scale-95 disabled:opacity-50">
                  <span className="block text-2xl">{button.emoji}</span><span className="mt-1 block text-xs font-semibold">{button.label}</span>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-error">{error}</p>}
          </div>
        )}
        <button onClick={() => setControlsOpen((open) => !open)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-5 py-4 font-semibold text-black shadow-glow">
          <Settings2 size={18} /> 幹事操作パネル {controlsOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        {presentationMode && (
          <button onClick={togglePresentationMode} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/95 px-4 py-2 text-xs text-text-muted">
            <Minimize2 size={14} /> 表示専用モードを終了
          </button>
        )}
      </div>}

      {presentationMode && !chromeVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 text-center text-[10px] text-text-muted/50">
          画面をタップして操作を表示
        </div>
      )}

      {sent && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-success/50 bg-background px-4 py-2 text-sm text-success shadow-glow">
          <CheckCircle2 size={16} className="mr-1 inline" /> {sent}を反映しました
        </div>
      )}
    </main>
  );
}

function MobileMetric({ icon, label, value, detail, tone = 'text-white' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="inline-flex items-center gap-1 text-[11px] text-text-muted">{icon}{label}</p>
      <p className={`mt-2 font-mono text-lg font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-[10px] text-text-muted">{detail}</p>
    </div>
  );
}
