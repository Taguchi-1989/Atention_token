'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mic, MicOff, Usb, RefreshCw } from 'lucide-react';

// F-03 USB-Cマイク入力：外部マイク認識・入力レベル表示・接続切断検知
interface MicDevice {
  deviceId: string;
  label: string;
  isExternal: boolean;
}

function classifyExternal(label: string): boolean {
  const l = label.toLowerCase();
  return /usb|外部|external|speakerphone|jabra|anker|powerconf|shure|r[oø]de|audio-technica|sennheiser/.test(l);
}

export default function MicCheckPage() {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [level, setLevel] = useState(0); // 0..1 RMS
  const [status, setStatus] = useState<'idle' | 'listening' | 'denied' | 'error'>('idle');

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setStatus('idle');
  }, []);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const mics = all
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || 'マイク（名称は許可後に表示されます）',
        isExternal: classifyExternal(d.label),
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
      if (current) setSelectedId(current.deviceId);

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
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus('listening');

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
  const levelPct = Math.round(level * 100);
  const levelLabel = status !== 'listening' ? '−' : level > 0.6 ? '大きめ' : level > 0.05 ? '正常' : '小さめ';

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center p-6">
      <div className="w-full max-w-lg space-y-5 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>

        <h1 className="text-2xl font-bold">マイク接続確認</h1>
        <p className="text-sm text-text-muted">
          USB-Cマイクを接続して入力テストを行います。音声はこの画面でのレベル表示のみに使われ、録音・保存はされません。
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
          <p>入力レベル：<span className={level > 0.05 ? 'text-success' : 'text-text-muted'}>{levelLabel}</span></p>
          <p>録音保存：<span className="text-success">OFF</span></p>
        </div>

        {external.length === 0 && devices.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            外部マイクが見つかりません。USB-Cマイクの接続を確認してください。内蔵マイクでもテストは可能です。
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
          <div className="h-4 w-full rounded-full bg-background overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${level > 0.8 ? 'bg-error' : level > 0.6 ? 'bg-warning' : 'bg-gradient-to-r from-primary to-success'}`}
              style={{ width: `${levelPct}%` }}
            />
          </div>
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
      </div>
    </div>
  );
}
