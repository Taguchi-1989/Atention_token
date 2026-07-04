'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Wine, Settings2, Mic, MicOff, Volume2, Gauge, Activity } from 'lucide-react';
import {
  fetchTbSession, fetchTbAlerts, tbMetricsWsUrl, isDemoMode, ingestDemoMetric,
  TbSession, TbAlert, TbAnalysis, NOISE_LABELS,
} from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';

const POLL_MS = 2000;
const ALERT_SHOW_MS = 25000;
const METRIC_SEND_MS = 1000;

const MODE_LABELS: Record<string, string> = {
  volume_only: '解析モード：A（音量のみ）',
  balance: '解析モード：B（音量＋発話バランス）',
  transcript: '解析モード：C（文字起こしあり）',
};

// F-04 テーブル表示モード ＋ F-06 丁重アラート ＋ Step 3/4 騒音・会話密度メーター
export default function TableDisplayPage() {
  const [session, setSession] = useState<TbSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [alert, setAlert] = useState<TbAlert | null>(null);
  const [analysis, setAnalysis] = useState<TbAnalysis | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const seqRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const stopMeasure = useCallback(() => {
    if (sendTimer.current) clearInterval(sendTimer.current);
    sendTimer.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setMeasuring(false);
  }, []);

  // Step 3: マイク音量を1秒ごとに集計して WebSocket でサーバーへ送る
  // （送るのは RMS/ピークの数値のみ。音声波形は端末外に出ない）
  const startMeasure = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const readMetric = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i];
          sum += v * v;
          const a = Math.abs(v);
          if (a > peak) peak = a;
        }
        return { rms: Math.min(1, Math.sqrt(sum / buf.length)), peak: Math.min(1, peak) };
      };

      // デモモード：サーバーなしでブラウザ内解析（音声は端末から出ない）
      if (isDemoMode()) {
        sendTimer.current = setInterval(() => {
          setAnalysis(ingestDemoMetric(readMetric().rms));
        }, METRIC_SEND_MS);
        setMeasuring(true);
        return;
      }

      const ws = new WebSocket(tbMetricsWsUrl());
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (!data.error) setAnalysis(data);
        } catch { /* 解析結果以外は無視 */ }
      };
      ws.onclose = () => { if (wsRef.current === ws) stopMeasure(); };
      ws.onerror = () => setMicError('サーバーに接続できませんでした');

      ws.onopen = () => {
        sendTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(readMetric()));
          }
        }, METRIC_SEND_MS);
        setMeasuring(true);
      };
    } catch (e) {
      setMicError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'マイクの使用が許可されませんでした'
          : 'マイクを開けませんでした'
      );
      stopMeasure();
    }
  }, [stopMeasure]);

  useEffect(() => () => stopMeasure(), [stopMeasure]);

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

      {/* Step 4: 騒音・会話密度メーター（F-04 表示項目） */}
      <section className="mb-4">
        {measuring && analysis ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Meter
              icon={<Volume2 size={16} />}
              label="店内音量"
              value={<span className={noiseTone}>{NOISE_LABELS[analysis.noiseCategory]}</span>}
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
        <PrivacyBar mode={session?.mode ?? null} />
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
