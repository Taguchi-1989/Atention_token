'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { startTbSession, getTbAgreedAt, SessionMode } from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';

// F-02 同意確認：解析モードを選んでからセッションを開始する
const MODES: { mode: SessionMode; label: string; desc: string; available: boolean }[] = [
  {
    mode: 'volume_only',
    label: 'モードA：音量のみ',
    desc: '騒音レベルと手動アラートだけを使います（録音なし）',
    available: true,
  },
  {
    mode: 'balance',
    label: 'モードB：音量＋発話バランス',
    desc: '発話の偏りも解析します（今後対応予定）',
    available: false,
  },
  {
    mode: 'transcript',
    label: 'モードC：文字起こしあり',
    desc: '明示同意のうえで文字起こしを行います（今後対応予定）',
    available: false,
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('飲み会');
  const [mode, setMode] = useState<SessionMode>('volume_only');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [agreedChecked, setAgreedChecked] = useState(false);

  // hydration不一致回避のため初期描画では判定せず、マウント後にsessionStorageを読む
  useEffect(() => {
    setAgreedAt(getTbAgreedAt());
    setAgreedChecked(true);
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await startTbSession(title || '飲み会', mode, agreedAt);
      router.push('/talkbalancer/mic');
    } catch {
      setError('セッションを開始できませんでした。サーバー接続を確認してください。');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center p-6">
      <div className="w-full max-w-lg space-y-6 py-8">
        <Link href="/talkbalancer/declaration" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> 開始前宣言に戻る
        </Link>

        <h1 className="text-2xl font-bold">同意確認</h1>

        {agreedChecked && !agreedAt && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            開始前宣言の合意がまだ記録されていません。先に参加者へ宣言を共有し、合意してから進んでください。
            {' '}
            <Link href="/talkbalancer/declaration" className="underline">開始前宣言へ戻る</Link>
          </p>
        )}

        <p className="text-text-muted text-sm">
          参加者に開始前宣言を見せたうえで、今日の解析モードを選んでください。
        </p>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">会の名前</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
          />
        </label>

        <div className="space-y-3">
          {MODES.map((m) => (
            <button
              key={m.mode}
              disabled={!m.available}
              onClick={() => setMode(m.mode)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                mode === m.mode
                  ? 'border-primary bg-surface-highlight'
                  : 'border-border bg-surface'
              } ${m.available ? 'hover:border-primary/50' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className="flex items-center justify-between font-semibold">
                {m.label}
                {mode === m.mode && <Check size={18} className="text-primary" />}
              </span>
              <span className="block text-sm text-text-muted mt-1">{m.desc}</span>
            </button>
          ))}
        </div>

        <PrivacyBar mode={mode} variant="card" />

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting || (agreedChecked && !agreedAt)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-4 font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {starting ? <Loader2 size={18} className="animate-spin" /> : null}
          この設定で開始する
        </button>
      </div>
    </div>
  );
}
