'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { fetchTbSession, sendTbAlert, isDemoMode, REMOTE_BUTTONS, AlertType, SessionMode } from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';

// F-05 幹事リモコン
export default function RemotePage() {
  const [active, setActive] = useState<boolean | null>(null);
  const [sending, setSending] = useState<AlertType | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);

  useEffect(() => {
    fetchTbSession()
      .then((s) => { setActive(s.active); setSessionMode(s.session?.mode ?? null); setDemo(isDemoMode()); })
      .catch(() => setActive(false));
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

        <PrivacyBar mode={sessionMode} className="pt-2" />
      </div>
    </div>
  );
}
