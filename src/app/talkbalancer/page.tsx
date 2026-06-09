'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Wine, Megaphone, MonitorSpeaker, Mic, ScrollText, Trash2, ArrowLeft } from 'lucide-react';
import { fetchTbSession, endTbSession, SessionState } from '@/lib/talkbalancer';

const MODE_LABELS: Record<string, string> = {
  volume_only: 'モードA：音量のみ',
  balance: 'モードB：音量＋発話バランス',
  transcript: 'モードC：文字起こしあり',
};

export default function TalkBalancerHome() {
  const [state, setState] = useState<SessionState | null>(null);
  const [apiError, setApiError] = useState(false);

  const load = useCallback(() => {
    fetchTbSession()
      .then((s) => { setState(s); setApiError(false); })
      .catch(() => setApiError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEnd = async () => {
    if (!window.confirm('セッションを終了し、データを削除しますか？')) return;
    await endTbSession();
    load();
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> Attention Ledger に戻る
        </Link>

        <header className="text-center space-y-3 py-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary items-center justify-center">
            <Wine size={32} />
          </div>
          <h1 className="text-3xl font-bold">TalkBalancer</h1>
          <p className="text-text-muted">飲み会に、やさしいブレーキを。</p>
        </header>

        {apiError && (
          <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
            サーバーに接続できません。Local Server が起動しているか確認してください。
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          {state?.active && state.session ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{state.session.title}（開催中）</p>
                <p className="text-text-muted">{MODE_LABELS[state.session.mode]}</p>
              </div>
              <button
                onClick={handleEnd}
                className="inline-flex items-center gap-1 rounded-lg border border-error/40 px-3 py-2 text-error hover:bg-error/10"
              >
                <Trash2 size={16} /> 終了して削除
              </button>
            </div>
          ) : (
            <p className="text-text-muted">セッションは開始されていません。開始前宣言から始めてください。</p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            録音保存：OFF ／ 文字起こし：OFF ／ クラウド送信：OFF
          </p>
        </div>

        <nav className="grid gap-3">
          <MenuLink href="/talkbalancer/declaration" icon={<ScrollText size={22} />}
            title="開始前宣言" desc="飲み会を始める前に、場のルールを宣言します" />
          <MenuLink href="/talkbalancer/table" icon={<MonitorSpeaker size={22} />}
            title="テーブル表示モード" desc="テーブル中央に置く画面。アラートを表示します" />
          <MenuLink href="/talkbalancer/remote" icon={<Megaphone size={22} />}
            title="幹事リモコン" desc="幹事のスマホから丁重アラートを送ります" />
          <MenuLink href="/talkbalancer/mic" icon={<Mic size={22} />}
            title="マイク接続確認" desc="USB-Cマイクの認識と入力レベルを確認します" />
        </nav>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:border-primary/50 hover:bg-surface-highlight transition-colors"
    >
      <span className="text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-text-muted">{desc}</span>
      </span>
    </Link>
  );
}
