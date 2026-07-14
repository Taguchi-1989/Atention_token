'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileText, Send, Users } from 'lucide-react';
import {
  createTbTranscriptNote,
  fetchTbSession,
  fetchTbSpeakerStats,
  fetchTbTranscriptNotes,
  recordTbSpeakerBatch,
  sendTbAlert,
  isDemoMode,
  REMOTE_BUTTONS,
  AlertType,
  TbSession,
  TbSpeakerStats,
  TbTranscriptNote,
} from '@/lib/talkbalancer';

// F-05 幹事リモコン
export default function RemotePage() {
  const [active, setActive] = useState<boolean | null>(null);
  const [sending, setSending] = useState<AlertType | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [session, setSession] = useState<TbSession | null>(null);
  const [speakerStats, setSpeakerStats] = useState<TbSpeakerStats | null>(null);
  const [durationSec, setDurationSec] = useState(15);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [transcriptNotes, setTranscriptNotes] = useState<TbTranscriptNote[]>([]);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptParticipantId, setTranscriptParticipantId] = useState('');

  useEffect(() => {
    fetchTbSession()
      .then((s) => { setActive(s.active); setSession(s.session); setDemo(isDemoMode()); })
      .catch(() => setActive(false));
    fetchTbSpeakerStats()
      .then(setSpeakerStats)
      .catch(() => {});
    fetchTbTranscriptNotes()
      .then((res) => setTranscriptNotes(res.notes))
      .catch(() => {});
  }, []);

  const handleSend = async (type: AlertType, label: string) => {
    setSending(type);
    setError(null);
    try {
      await sendTbAlert(type);
      setSent(label);
      setTimeout(() => setSent(null), 2500);
    } catch {
      setError('送信できませんでした。セッションが開始されているか確認してください。');
    } finally {
      setSending(null);
    }
  };

  const addPending = (participantId: string) => {
    setPending((prev) => ({
      ...prev,
      [participantId]: (prev[participantId] ?? 0) + durationSec,
    }));
  };

  const handleFlushSpeakers = async () => {
    const events = Object.entries(pending)
      .filter(([, seconds]) => seconds > 0)
      .map(([participantId, durationSec]) => ({ participantId, durationSec }));
    if (events.length === 0) return;
    setError(null);
    try {
      const res = await recordTbSpeakerBatch(events);
      setSpeakerStats(res.stats);
      setPending({});
      setSent('話者バランス');
      setTimeout(() => setSent(null), 2500);
    } catch {
      setError('話者記録を反映できませんでした。セッションが開始されているか確認してください。');
    }
  };

  const handleCreateTranscriptNote = async () => {
    const text = transcriptText.trim();
    if (!text) return;
    setError(null);
    try {
      const res = await createTbTranscriptNote(text, transcriptParticipantId || undefined);
      setTranscriptNotes(res.notes);
      setTranscriptText('');
      setSent('文字起こしメモ');
      setTimeout(() => setSent(null), 2500);
    } catch {
      setError('文字起こしメモを保存できませんでした。モードCで開始されているか確認してください。');
    }
  };

  const pendingTotal = Object.values(pending).reduce((a, b) => a + b, 0);
  const balanceEnabled = session?.mode === 'balance' || session?.mode === 'transcript';
  const transcriptEnabled = session?.mode === 'transcript';

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center p-6">
      <div className="w-full max-w-md space-y-5 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>

        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          幹事リモコン
          {demo && (
            <span className="rounded-full border border-secondary/60 bg-secondary/10 px-2 py-0.5 text-xs font-normal text-secondary">
              デモモード
            </span>
          )}
        </h1>
        <p className="text-sm text-text-muted">
          ボタンを押すと、テーブル画面に丁重な文言でアラートが表示されます。
          誰が押したかは表示されません。
        </p>

        {active === false && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            セッションが開始されていません。先に
            <Link href="/talkbalancer/declaration" className="underline mx-1">開始前宣言</Link>
            から始めてください。
          </div>
        )}

        {speakerStats && speakerStats.participants.length > 0 && balanceEnabled && (
          <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 font-semibold">
                  <Users size={18} className="text-primary" /> 話者記録
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  いま話していた人を押して、まとめて円グラフに反映します。
                </p>
              </div>
              <select
                aria-label="発話時間の追加単位"
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary"
              >
                <option value={5}>+5秒</option>
                <option value={15}>+15秒</option>
                <option value={30}>+30秒</option>
                <option value={60}>+60秒</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {speakerStats.participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPending(p.id)}
                  className="rounded-xl border border-border bg-background/60 p-3 text-left hover:border-primary/60 active:scale-95 transition-all"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">
                    未反映 {pending[p.id] ?? 0}秒
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleFlushSpeakers}
              disabled={pendingTotal === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} /> バッチ反映（{pendingTotal}秒）
            </button>
          </section>
        )}

        {transcriptEnabled && (
          <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div>
              <h2 className="inline-flex items-center gap-2 font-semibold">
                <FileText size={18} className="text-primary" /> 文字起こしメモ
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                録音保存はせず、同意済みの場で要点だけをメモリ内に残します。
              </p>
            </div>

            <div className="grid gap-2">
              <select
                aria-label="文字起こしメモの話者"
                value={transcriptParticipantId}
                onChange={(e) => setTranscriptParticipantId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">話者未指定</option>
                {speakerStats?.participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="例：次の話題は二次会の場所。佐藤さんが駅近を希望。"
                className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={handleCreateTranscriptNote}
                disabled={!transcriptText.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} /> メモを追加
              </button>
            </div>

            {transcriptNotes.length > 0 && (
              <div className="space-y-2">
                {transcriptNotes.slice(-3).reverse().map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                    <p className="mb-1 text-xs text-text-muted">
                      {note.participantName ?? '話者未指定'} ／ {new Date(note.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          {REMOTE_BUTTONS.map((b) => (
            <button
              key={b.type}
              onClick={() => handleSend(b.type, b.label)}
              disabled={sending !== null}
              className="rounded-2xl border border-border bg-surface p-5 text-center hover:border-primary/60 hover:bg-surface-highlight active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="block text-3xl mb-2">{b.emoji}</span>
              <span className="block font-semibold text-sm">{b.label}</span>
            </button>
          ))}
        </div>

        {sent && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-success/15 border border-success/50 px-5 py-3 text-success text-sm shadow-glow">
            <CheckCircle2 size={18} /> 「{sent}」をテーブルに表示しました
          </div>
        )}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
