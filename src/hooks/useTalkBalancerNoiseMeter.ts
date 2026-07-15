'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ingestDemoMetric,
  isDemoMode,
  TbAnalysis,
  tbMetricsWsUrl,
} from '@/lib/talkbalancer';
import {
  classifyExternalMic,
  clearMicPreference,
  loadMicPreference,
  saveMicPreference,
  TalkBalancerMicPreference,
} from '@/lib/talkbalancer-mic';

const METRIC_SEND_MS = 1000;

export function useTalkBalancerNoiseMeter() {
  const [analysis, setAnalysis] = useState<TbAnalysis | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMic, setActiveMic] = useState<TalkBalancerMicPreference | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (sendTimer.current) clearInterval(sendTimer.current);
    sendTimer.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setActiveMic(null);
    setMeasuring(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setDisconnected(false);
    stop();
    try {
      const preferred = loadMicPreference();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: preferred?.deviceId ? { deviceId: { exact: preferred.deviceId } } : true,
        });
      } catch (micError) {
        const errorName = micError instanceof Error ? micError.name : '';
        if (!preferred || errorName === 'NotAllowedError') throw micError;
        clearMicPreference();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('音声入力がありません');
      track.addEventListener('ended', () => {
        if (streamRef.current !== stream) return;
        stop();
        setError(null);
        setDisconnected(true);
      });
      const settings = track.getSettings();
      const detectedMic: TalkBalancerMicPreference = {
        deviceId: settings.deviceId ?? '',
        label: track.label || '既定の内蔵マイク',
        isExternal: classifyExternalMic(track.label),
      };
      setActiveMic(detectedMic);
      saveMicPreference(detectedMic);

      const context = new AudioContext();
      ctxRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      const readMetric = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < buffer.length; i++) {
          const value = buffer[i];
          sum += value * value;
          peak = Math.max(peak, Math.abs(value));
        }
        return {
          rms: Math.min(1, Math.sqrt(sum / buffer.length)),
          peak: Math.min(1, peak),
        };
      };

      if (isDemoMode()) {
        sendTimer.current = setInterval(() => {
          setAnalysis(ingestDemoMetric(readMetric().rms));
        }, METRIC_SEND_MS);
        setMeasuring(true);
        return;
      }

      const ws = new WebSocket(tbMetricsWsUrl());
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.error) setAnalysis(data);
        } catch {
          // 解析結果以外は無視する。
        }
      };
      ws.onerror = () => setError('サーバーに接続できませんでした');
      ws.onclose = () => {
        if (wsRef.current === ws) stop();
      };
      ws.onopen = () => {
        sendTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(readMetric()));
        }, METRIC_SEND_MS);
        setMeasuring(true);
      };
    } catch (micError) {
      const errorName = micError instanceof Error ? micError.name : '';
      setError(
        errorName === 'NotAllowedError'
          ? 'マイクの使用が許可されませんでした'
          : 'マイクを開けませんでした'
      );
      stop();
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    activeMic,
    analysis,
    disconnected,
    error,
    measuring,
    start,
    stop,
  };
}
