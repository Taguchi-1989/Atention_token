'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, FileText, Mic, MicOff, ShieldCheck, Users } from 'lucide-react';
import {
  fetchTbSession,
  fetchTbSpeakerStats,
  fetchTbTranscriptNotes,
  fetchTbTranscriptionStatus,
  SessionState,
  TbSpeakerStats,
  TbTranscriptNote,
  TbTranscriptionStatus,
} from '@/lib/talkbalancer';
import {
  readTalkBalancerRuntime,
  summarizeSpeakerBalance,
  TALK_BALANCER_RUNTIME_EVENT,
  TalkBalancerRuntimeState,
} from '@/lib/talkbalancer-live-status';

const REFRESH_MS = 2_000;

function transcriptionLabel(state?: string): string {
  return ({
    off: '文字起こし停止中',
    starting: '文字起こし準備中',
    listening: '文字起こし中',
    processing: '文字起こし処理中',
    unavailable: '文字起こしモデル未導入',
    error: '文字起こしを確認してください',
  } as Record<string, string>)[state ?? 'off'] ?? '文字起こし停止中';
}

function sourcePathLabel(path?: string | null): string {
  if (path === '/talkbalancer/mobile') return '携帯1台画面';
  if (path === '/talkbalancer/table') return 'テーブル画面';
  if (path === '/talkbalancer/mic') return 'マイク確認画面';
  return '別のTalkBalancer画面';
}

export default function TalkBalancerLiveStatus() {
  const pathname = usePathname();
  const enabled = pathname.startsWith('/talkbalancer');
  const organizerView = pathname === '/talkbalancer/remote';
  const publicView = pathname === '/talkbalancer/table' || pathname === '/talkbalancer/mobile';
  const [expanded, setExpanded] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [runtime, setRuntime] = useState<TalkBalancerRuntimeState | null>(null);
  const [speakerStats, setSpeakerStats] = useState<TbSpeakerStats | null>(null);
  const [notes, setNotes] = useState<TbTranscriptNote[]>([]);
  const [transcription, setTranscription] = useState<TbTranscriptionStatus | null>(null);

  const refresh = useCallback(async () => {
    setRuntime(readTalkBalancerRuntime());
    try {
      const session = await fetchTbSession();
      setSessionState(session);
      if (!session.active) {
        setSpeakerStats(null);
        setNotes([]);
        setTranscription(null);
        return;
      }
      const transcriptionResult = await Promise.resolve(fetchTbTranscriptionStatus());
      setTranscription(transcriptionResult);
      if (organizerView) {
        const [speakerResult, noteResult] = await Promise.allSettled([
          fetchTbSpeakerStats(),
          fetchTbTranscriptNotes(),
        ]);
        if (speakerResult.status === 'fulfilled') setSpeakerStats(speakerResult.value);
        if (noteResult.status === 'fulfilled') setNotes(noteResult.value.notes);
      } else {
        setSpeakerStats(null);
        setNotes([]);
      }
    } catch {
      // 一時的な通信失敗時は直前の表示を維持する。
    }
  }, [organizerView]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onRuntime = (event: Event) => {
      const custom = event as CustomEvent<TalkBalancerRuntimeState | null>;
      setRuntime(custom.detail ?? readTalkBalancerRuntime());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('talkbalancer.')) setRuntime(readTalkBalancerRuntime());
    };
    window.addEventListener(TALK_BALANCER_RUNTIME_EVENT, onRuntime);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(TALK_BALANCER_RUNTIME_EVENT, onRuntime);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, refresh]);

  const measuring = runtime?.measuring === true;
  const measuringElsewhere = measuring && Boolean(runtime?.sourcePath) && runtime?.sourcePath !== pathname;
  const session = sessionState?.session ?? null;
  const transcriptMode = session?.mode === 'transcript';
  const balance = useMemo(() => summarizeSpeakerBalance(speakerStats), [speakerStats]);
  const latestNotes = useMemo(() => notes.slice(-5).reverse(), [notes]);

  if (!enabled) return null;

  return (
    <aside
      className={`fixed right-4 ${pathname === '/talkbalancer/mobile' ? 'z-[25]' : 'z-[80]'} w-[min(22rem,calc(100vw-2rem))] text-white`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      aria-label="TalkBalancer稼働状況"
    >
      {expanded && (
        <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-[#071426]/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">TalkBalancer 稼働状況</p>
              <p className="mt-1 text-xs text-text-muted">全画面共通・端末内表示</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-border p-1.5 text-text-muted hover:text-white"
              aria-label="稼働状況を閉じる"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <div className={`rounded-xl border p-3 ${measuring ? 'border-red-500/60 bg-red-500/10' : 'border-border bg-surface'}`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${measuring ? 'animate-pulse bg-red-500 shadow-[0_0_14px_#ef4444]' : 'bg-slate-500'}`} />
              <div>
                <p className="text-sm font-semibold">{measuring ? measuringElsewhere ? '別画面でマイク計測中' : 'この画面でマイク計測中' : sessionState?.active ? 'セッション中・計測停止' : '停止中'}</p>
                <p className="text-xs text-text-muted">{measuring ? `${sourcePathLabel(runtime?.sourcePath)} ／ ${runtime?.micLabel ?? 'マイク'}（音声保存なし）` : '赤点灯時だけ音量を計測します'}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <p className="rounded-lg bg-surface px-3 py-2"><ShieldCheck size={13} className="mr-1 inline text-success" />録音保存 <span className="font-mono text-success">OFF</span></p>
            <p className="rounded-lg bg-surface px-3 py-2">クラウド送信 <span className="font-mono text-success">OFF</span></p>
          </div>

          {transcriptMode && (
            <section className="mt-3 rounded-xl border border-secondary/30 bg-surface p-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} className="text-secondary" />ローカル文字起こし</h2>
              <p className="mt-2 text-sm font-semibold text-secondary">{transcriptionLabel(transcription?.state)}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">音声は自宅PCのメモリ上で短時間処理し、録音ファイルを作りません。</p>
              {transcription?.currentSpeakerKey && (
                <p className="mt-2 rounded-lg bg-background/70 px-3 py-2 text-xs">
                  {organizerView ? `現在：${transcription.currentSpeakerName ?? '未対応話者'}` : '現在：発話を検知中'}
                </p>
              )}
              {transcription?.error && <p className="mt-2 text-xs text-warning">{transcription.error}</p>}
            </section>
          )}

          {organizerView && <section className="mt-4 rounded-xl border border-border bg-surface p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-primary" />発話バランス</h2>
            <p className={`mt-2 text-sm font-semibold ${balance.state === 'attention' ? 'text-warning' : 'text-white'}`}>{balance.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{balance.guidance}</p>
            {speakerStats && speakerStats.totalSeconds > 0 && (
              <div className="mt-3 space-y-2">
                {speakerStats.total.slice(0, 6).map((person) => (
                  <div key={person.participantId}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span>{person.name}</span>
                      <span className="font-mono">{Math.round(person.share * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(person.share * 100)}%`, backgroundColor: person.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-text-muted">この割合は幹事の話者タップ記録から算出します。マイクだけでは誰が話したかを判別していません。</p>
          </section>}

          {organizerView && <section className="mt-3 rounded-xl border border-border bg-surface p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} className="text-secondary" />文字メモ</h2>
            <p className="mt-1 text-xs text-text-muted">
              {transcriptMode ? '自動文字起こし＋手動補正メモ' : 'OFF（モードCで使用できます）'}
            </p>
            {transcriptMode && latestNotes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {latestNotes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-background/70 px-3 py-2 text-xs leading-relaxed">
                    {note.participantName && <span className="mr-2 font-semibold text-secondary">{note.participantName}</span>}
                    <span>{note.text}</span>
                  </li>
                ))}
              </ul>
            ) : transcriptMode ? (
              <p className="mt-3 text-xs text-text-muted">まだ文字起こしはありません。マイク計測を開始すると約4秒ごとに追加されます。</p>
            ) : null}
          </section>}

          {publicView && <p className="mt-3 text-[10px] leading-relaxed text-text-muted">参加者向け画面では個人名と文字起こし本文を表示しません。詳細は幹事リモコンで確認できます。</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`ml-auto flex min-h-12 items-center gap-3 rounded-full border px-4 py-2 shadow-xl backdrop-blur-xl transition-colors ${
          measuring ? 'border-red-500/70 bg-[#240b12]/95' : 'border-slate-600 bg-[#101827]/95'
        }`}
        aria-expanded={expanded}
      >
        <span className={`h-3 w-3 rounded-full ${measuring ? 'animate-pulse bg-red-500 shadow-[0_0_14px_#ef4444]' : 'bg-slate-500'}`} />
        {measuring ? <Mic size={16} className="text-red-300" /> : <MicOff size={16} className="text-slate-400" />}
        <span className="text-left">
          <span className="block text-xs font-semibold">{measuring ? measuringElsewhere ? '別画面で計測中' : '計測中（保存なし）' : sessionState?.active ? '計測停止中' : '停止中'}</span>
          {transcriptMode && <span className="block text-[10px] text-secondary">{transcriptionLabel(transcription?.state)}</span>}
        </span>
      </button>
    </aside>
  );
}
