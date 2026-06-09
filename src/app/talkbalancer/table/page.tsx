'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Wine, Settings2 } from 'lucide-react';
import { fetchTbSession, fetchTbAlerts, TbSession, TbAlert } from '@/lib/talkbalancer';

const POLL_MS = 2000;
const ALERT_SHOW_MS = 25000;

const MODE_LABELS: Record<string, string> = {
  volume_only: '解析モード：A（音量のみ）',
  balance: '解析モード：B（音量＋発話バランス）',
  transcript: '解析モード：C（文字起こしあり）',
};

// F-04 テーブル表示モード ＋ F-06 丁重アラート表示
export default function TableDisplayPage() {
  const [session, setSession] = useState<TbSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [alert, setAlert] = useState<TbAlert | null>(null);
  const seqRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="min-h-screen bg-background text-white flex flex-col p-6 select-none">
      {/* ヘッダー：会名と解析モード */}
      <header className="flex items-center justify-between text-sm text-text-muted">
        <span className="inline-flex items-center gap-2">
          <Wine size={18} className="text-primary" />
          <span className="font-semibold text-white">{session?.title ?? 'TalkBalancer'}</span>
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

      {/* フッター：プライバシー表示（10.1 常時表示） */}
      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-text-muted">
        <span className="font-mono">
          録音保存：OFF ／ 文字起こし：OFF ／ クラウド送信：OFF
        </span>
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 hover:text-white">
          <Settings2 size={14} /> 管理
        </Link>
      </footer>
    </div>
  );
}
