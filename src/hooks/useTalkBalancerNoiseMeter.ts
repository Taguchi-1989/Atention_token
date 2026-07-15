'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ingestDemoMetric,
  isDemoMode,
  TbAnalysis,
  TbTranscriptionStatus,
  tbMetricsWsUrl,
  tbTranscriptionWsUrl,
} from '@/lib/talkbalancer';
import { downsampleToPcm16, TALK_BALANCER_PCM_SAMPLE_RATE } from '@/lib/talkbalancer-audio';
import {
  classifyExternalMic,
  clearMicPreference,
  loadMicPreference,
  saveMicPreference,
  TalkBalancerMicPreference,
} from '@/lib/talkbalancer-mic';
import {
  clearTalkBalancerRuntime,
  createTalkBalancerRuntimeSourceId,
  publishTalkBalancerRuntime,
  readTalkBalancerRuntime,
  TALK_BALANCER_RUNTIME_EVENT,
} from '@/lib/talkbalancer-live-status';

const METRIC_SEND_MS = 1000;

interface NoiseMeterOptions {
  transcriptionEnabled?: boolean;
}

export function useTalkBalancerNoiseMeter({ transcriptionEnabled = false }: NoiseMeterOptions = {}) {
  const [analysis, setAnalysis] = useState<TbAnalysis | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMic, setActiveMic] = useState<TalkBalancerMicPreference | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [transcription, setTranscription] = useState<TbTranscriptionStatus | null>(null);
  const [measuringElsewhere, setMeasuringElsewhere] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptionWsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const sendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const runtimeHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const runtimeSourceId = useRef(createTalkBalancerRuntimeSourceId());

  const startRuntimeHeartbeat = useCallback((micLabel: string | null) => {
    if (runtimeHeartbeat.current) clearInterval(runtimeHeartbeat.current);
    publishTalkBalancerRuntime(runtimeSourceId.current, micLabel);
    runtimeHeartbeat.current = setInterval(() => {
      publishTalkBalancerRuntime(runtimeSourceId.current, micLabel);
    }, 2_000);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const shared = readTalkBalancerRuntime();
      setMeasuringElsewhere(shared?.measuring === true && shared.sourceId !== runtimeSourceId.current);
    };
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    window.addEventListener(TALK_BALANCER_RUNTIME_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(TALK_BALANCER_RUNTIME_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stopTranscriptionStream = useCallback(() => {
    const processor = processorRef.current;
    processorRef.current = null;
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    silenceGainRef.current?.disconnect();
    silenceGainRef.current = null;
    const transcriptionWs = transcriptionWsRef.current;
    transcriptionWsRef.current = null;
    if (transcriptionWs && transcriptionWs.readyState < WebSocket.CLOSING) transcriptionWs.close();
    setTranscription((current) => current ? { ...current, active: false, state: 'off', currentSpeakerKey: null, currentSpeakerName: null } : null);
  }, []);

  const stop = useCallback(() => {
    if (runtimeHeartbeat.current) clearInterval(runtimeHeartbeat.current);
    runtimeHeartbeat.current = null;
    clearTalkBalancerRuntime(runtimeSourceId.current);
    stopTranscriptionStream();
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
  }, [stopTranscriptionStream]);

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
      const mediaSource = context.createMediaStreamSource(stream);
      mediaSource.connect(analyser);
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
        startRuntimeHeartbeat(detectedMic.label);
        if (transcriptionEnabled) {
          setTranscription({
            active: false,
            state: 'unavailable',
            sourceId: null,
            engineAvailable: false,
            engine: null,
            model: 'local-server-required',
            speakerEngine: 'acoustic',
            currentSpeakerKey: null,
            currentParticipantId: null,
            currentSpeakerName: null,
            currentSpeakerConfidence: 0,
            latestText: '',
            updatedAt: new Date().toISOString(),
            audioRetention: 'memory-only',
            cloudUpload: false,
            clusters: [],
            error: '公開PWAではローカル文字起こしを利用できません',
          });
        }
        return;
      }

      const startTranscription = () => {
        if (!transcriptionEnabled) return;
        const transcriptionWs = new WebSocket(tbTranscriptionWsUrl());
        transcriptionWs.binaryType = 'arraybuffer';
        transcriptionWsRef.current = transcriptionWs;
        transcriptionWs.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as TbTranscriptionStatus & { type?: string };
            if (message.type === 'transcription_status' || message.type === 'speaker_status') {
              setTranscription(message);
            }
          } catch {
            // 状態メッセージ以外は無視する。
          }
        };
        transcriptionWs.onerror = () => {
          setTranscription((current) => current ? { ...current, state: 'error', error: 'ローカル文字起こしに接続できません' } : null);
        };
        transcriptionWs.onclose = () => {
          if (transcriptionWsRef.current !== transcriptionWs) return;
          transcriptionWsRef.current = null;
          setTranscription((current) => current ? { ...current, active: false, state: 'off', currentSpeakerKey: null, currentSpeakerName: null } : null);
        };
        transcriptionWs.onopen = () => {
          transcriptionWs.send(JSON.stringify({
            type: 'start',
            sourceId: runtimeSourceId.current,
            sampleRate: TALK_BALANCER_PCM_SAMPLE_RATE,
            micLabel: detectedMic.label,
          }));
          const processor = context.createScriptProcessor(4096, 1, 1);
          const silenceGain = context.createGain();
          silenceGain.gain.value = 0;
          processorRef.current = processor;
          silenceGainRef.current = silenceGain;
          mediaSource.connect(processor);
          processor.connect(silenceGain);
          silenceGain.connect(context.destination);
          processor.onaudioprocess = (audioEvent) => {
            if (transcriptionWs.readyState !== WebSocket.OPEN) return;
            const channel = audioEvent.inputBuffer.getChannelData(0);
            const pcm = downsampleToPcm16(channel, context.sampleRate);
            if (pcm.byteLength > 0) transcriptionWs.send(pcm);
          };
        };
      };

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
        startRuntimeHeartbeat(detectedMic.label);
        startTranscription();
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
  }, [startRuntimeHeartbeat, stop, transcriptionEnabled]);

  useEffect(() => () => stop(), [stop]);

  return {
    activeMic,
    analysis,
    disconnected,
    error,
    measuring,
    measuringElsewhere,
    transcription,
    start,
    stop,
  };
}
