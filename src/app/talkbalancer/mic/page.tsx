'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Gauge, Laptop, Mic, MicOff, Usb, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  classifyExternalMic,
  rmsToDbfs,
  rmsToRelativeLevel,
  saveMicPreference,
  TalkBalancerMicPreference,
} from '@/lib/talkbalancer-mic';
import { fetchTbSession, SessionMode } from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';
import { TalkBalancerSetupSteps } from '@/components/talkbalancer/TalkBalancerSetupSteps';
import {
  clearTalkBalancerRuntime,
  createTalkBalancerRuntimeSourceId,
  publishTalkBalancerRuntime,
} from '@/lib/talkbalancer-live-status';

// F-03 マイク入力：外部／内蔵の識別・相対入力レベル表示・接続切断検知
interface MicDevice {
  deviceId: string;
  label: string;
  isExternal: boolean;
}

export default function MicCheckPage() {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [level, setLevel] = useState(0); // 0..1 RMS
  const [peak, setPeak] = useState(0);
  const [activeDevice, setActiveDevice] = useState<TalkBalancerMicPreference | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'denied' | 'error'>('idle');
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const runtimeHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const runtimeSourceId = useRef(createTalkBalancerRuntimeSourceId());

  const stop = useCallback(() => {
    if (runtimeHeartbeat.current) clearInterval(runtimeHeartbeat.current);
    runtimeHeartbeat.current = null;
    clearTalkBalancerRuntime(runtimeSourceId.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setPeak(0);
    setActiveDevice(null);
    setStatus('idle');
  }, []);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const mics = all
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || 'マイク（名称は許可後に表示されます）',
        isExternal: classifyExternalMic(d.label),
      }));
    setDevices(mics);
    return mics;
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      streamRef.current = stream;
      // 許可後はデバイス名（label）が取得できるので一覧を更新する
      const mics = await refreshDevices();
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      const current = mics.find((m) => m.deviceId === settings.deviceId);
      const preference: TalkBalancerMicPreference = current ?? {
        deviceId: settings.deviceId ?? deviceId ?? '',
        label: track.label || '既定の内蔵マイク',
        isExternal: classifyExternalMic(track.label),
      };
      setSelectedId(preference.deviceId);
      setActiveDevice(preference);
      saveMicPreference(preference);

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        let nextPeak = 0;
        for (let i = 0; i < buf.length; i++) {
          sum += buf[i] * buf[i];
          nextPeak = Math.max(nextPeak, Math.abs(buf[i]));
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length)));
        setPeak(Math.min(1, nextPeak));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus('listening');
      publishTalkBalancerRuntime(runtimeSourceId.current, preference.label);
      runtimeHeartbeat.current = setInterval(() => {
        publishTalkBalancerRuntime(runtimeSourceId.current, preference.label);
      }, 2_000);

      track.addEventListener('ended', () => {
        // 接続切断検知（F-03）
        stop();
        refreshDevices();
      });
    } catch (e) {
      setStatus(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [stop, refreshDevices]);

  useEffect(() => {
    refreshDevices().catch(() => {});
    fetchTbSession().then((s) => {
      setSessionMode(s.session?.mode ?? null);
      setSessionActive(s.active);
    }).catch(() => {});
    const onChange = () => refreshDevices().catch(() => {});
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
      stop();
    };
    // stop/refreshDevices は安定参照
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const external = devices.filter((d) => d.isExternal);
  const builtIn = devices.filter((d) => !d.isExternal);
  const levelPct = rmsToRelativeLevel(level);
  const peakPct = rmsToRelativeLevel(peak);
  const levelDbfs = rmsToDbfs(level);
  const levelLabel = status !== 'listening' ? '−' : level > 0.16 ? 'かなり高め' : level > 0.08 ? '高め' : level > 0.02 ? '普通' : '低め';

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center p-6">
      <div className="w-full max-w-lg space-y-5 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>

        <h1 className="text-2xl font-bold">マイク接続確認</h1>
        <TalkBalancerSetupSteps current={3} />
        <p className="text-sm text-text-muted">
          外部マイクまたはPC内蔵マイクで入力テストを行います。音声はこの画面でのレベル表示のみに使われ、録音・保存はされません。
        </p>

        {/* 接続状態（F-03 表示例） */}
        <div className="rounded-xl border border-border bg-surface p-4 text-sm font-mono space-y-1">
          <p>
            外部マイク：
            {external.length > 0 ? (
              <span className="text-success">接続済み（{external.length}台）</span>
            ) : (
              <span className="text-warning">未検出</span>
            )}
          </p>
          <p>使用中：<span className="text-white">{activeDevice?.label ?? '未選択'}</span></p>
          <p>計測方式：<span className={activeDevice && !activeDevice.isExternal ? 'text-warning' : 'text-success'}>
            {activeDevice ? (activeDevice.isExternal ? '外部マイク（推奨）' : '内蔵マイク簡易モード') : '−'}
          </span></p>
          <p>入力レベル：<span className={level > 0.02 ? 'text-success' : 'text-text-muted'}>{levelLabel}</span></p>
          <p>録音保存：<span className="text-success">OFF</span></p>
        </div>

        {external.length === 0 && devices.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            <p className="font-semibold">外部マイクがなくても進められます</p>
            <p className="mt-1 text-warning/90">
              PC内蔵マイクは収音範囲や自動ゲインの影響で精度が下がりますが、同じPC・同じ置き場所での相対音量を目安に簡易運用できます。
            </p>
            <button
              onClick={() => start(builtIn[0]?.deviceId)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 font-semibold text-white hover:bg-warning/20"
            >
              <Laptop size={16} /> 内蔵マイクで簡易計測を開始
            </button>
          </div>
        )}

        {activeDevice && !activeDevice.isExternal && status === 'listening' && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-warning">
              <ShieldAlert size={17} /> 内蔵マイク簡易モード
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
              <li>表示値は物理的な騒音dBではなく、端末内の相対値です。</li>
              <li>PCをテーブル中央寄りに置き、途中で位置や入力音量を変えないでください。</li>
              <li>開始前に静かな状態と通常会話を各10秒試し、数値差を確認してください。</li>
            </ul>
          </div>
        )}

        {/* デバイス一覧 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-muted">入力デバイス</h2>
            <button onClick={() => refreshDevices()} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-white">
              <RefreshCw size={13} /> 再読み込み
            </button>
          </div>
          {devices.length === 0 && (
            <p className="text-sm text-text-muted">デバイスが見つかりません。下のボタンでマイク許可を与えると一覧が表示されます。</p>
          )}
          {devices.map((d) => (
            <button
              key={d.deviceId || d.label}
              onClick={() => start(d.deviceId)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                selectedId === d.deviceId && status === 'listening'
                  ? 'border-primary bg-surface-highlight'
                  : 'border-border bg-surface hover:border-primary/50'
              }`}
            >
              {d.isExternal ? <Usb size={18} className="text-primary shrink-0" /> : <Mic size={18} className="text-text-muted shrink-0" />}
              <span className="flex-1 truncate">{d.label}</span>
              <span className="text-xs text-text-muted">{d.isExternal ? '外部' : '内蔵'}</span>
            </button>
          ))}
        </div>

        {/* レベルメーター */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-xs text-text-muted">相対音量</p>
              <p className="mt-1 font-mono text-lg font-semibold">{status === 'listening' ? `${levelPct}/100` : '−'}</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-xs text-text-muted">入力値</p>
              <p className="mt-1 font-mono text-lg font-semibold">{status === 'listening' ? `${levelDbfs.toFixed(1)} dBFS` : '−'}</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-xs text-text-muted">ピーク</p>
              <p className="mt-1 font-mono text-lg font-semibold">{status === 'listening' ? `${peakPct}/100` : '−'}</p>
            </div>
          </div>
          <div className="h-4 w-full rounded-full bg-background overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${level > 0.16 ? 'bg-error' : level > 0.08 ? 'bg-warning' : 'bg-gradient-to-r from-primary to-success'}`}
              style={{ width: `${levelPct}%` }}
            />
          </div>
          <p className="flex items-center gap-1 text-xs text-text-muted">
            <Gauge size={13} /> dBFSと0〜100は端末内の参考値です。マイクやOSが変わると値も変わります。
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-text-muted">{status === 'listening' ? `${levelPct}%` : '停止中'}</span>
            {status === 'listening' ? (
              <button onClick={stop} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-highlight">
                <MicOff size={16} /> テスト停止
              </button>
            ) : (
              <button onClick={() => start(selectedId || undefined)} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
                <Mic size={16} /> 入力テスト開始
              </button>
            )}
          </div>
          {status === 'denied' && <p className="text-sm text-error">マイクの使用が許可されませんでした。ブラウザの設定を確認してください。</p>}
          {status === 'error' && <p className="text-sm text-error">マイクを開けませんでした。接続を確認して再試行してください。</p>}
        </div>

        {sessionActive && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">テスト済みのマイクがテーブル表示の騒音メーターに使われます。</p>
            <Link
              href="/talkbalancer/table"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-4 font-semibold text-black hover:opacity-90"
            >
              テーブル表示へ進む <ArrowRight size={18} />
            </Link>
          </div>
        )}

        <PrivacyBar mode={sessionMode} className="pt-2" />
      </div>
    </div>
  );
}
