'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { startTbSession, SessionMode } from '@/lib/talkbalancer';

// F-02 同意確認：解析モードを選んでからセッションを開始する
const MODES: { mode: SessionMode; label: string; desc: string }[] = [
  {
    mode: 'volume_only',
    label: 'モードA：音量のみ',
    desc: '騒音レベルと手動アラートだけを使います（録音なし）',
  },
  {
    mode: 'balance',
    label: 'モードB：音量＋発話バランス',
    desc: '参加者ごとの発話時間を記録し、全体/直近5分の偏りを見える化します',
  },
  {
    mode: 'transcript',
    label: 'モードC：文字起こしあり',
    desc: '明示同意のうえで、録音保存なしの文字起こしメモをメモリ内に残します',
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('飲み会');
  const [mode, setMode] = useState<SessionMode>('volume_only');
  const [participantCount, setParticipantCount] = useState(4);
  const [participantNames, setParticipantNames] = useState(['Aさん', 'Bさん', 'Cさん', 'Dさん']);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCountChange = (count: number) => {
    const next = Math.max(1, Math.min(20, count));
    setParticipantCount(next);
    setParticipantNames((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? `${String.fromCharCode(65 + i)}さん`));
  };

  const handleNameChange = (index: number, value: string) => {
    setParticipantNames((prev) => prev.map((name, i) => (i === index ? value : name)));
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const names = participantNames
        .slice(0, participantCount)
        .map((name, i) => name.trim() || `${String.fromCharCode(65 + i)}さん`);
      await startTbSession(title || '飲み会', mode, names);
      const startTarget = window.localStorage.getItem('talkbalancer.startTarget');
      const requestedAt = Number(window.localStorage.getItem('talkbalancer.startTargetAt'));
      window.localStorage.removeItem('talkbalancer.startTarget');
      window.localStorage.removeItem('talkbalancer.startTargetAt');
      const mobileRequested = startTarget === 'mobile'
        && Number.isFinite(requestedAt)
        && Date.now() - requestedAt < 30 * 60 * 1000;
      router.push(mobileRequested ? '/talkbalancer/mobile' : '/talkbalancer/table');
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

        <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
          <div>
            <h2 className="font-semibold">テーブル人数</h2>
            <p className="mt-1 text-sm text-text-muted">
              MVPでは幹事が話者をタップして記録します。将来の話者分離はこの参加者ラベルに接続します。
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-sm text-text-muted">人数</span>
            <input
              type="number"
              min={1}
              max={20}
              value={participantCount}
              onChange={(e) => handleCountChange(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {participantNames.slice(0, participantCount).map((name, i) => (
              <label key={i} className="block space-y-1">
                <span className="text-xs text-text-muted">参加者 {i + 1}</span>
                <input
                  value={name}
                  maxLength={30}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        </section>

        <div className="space-y-3">
          {MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => setMode(m.mode)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                mode === m.mode
                  ? 'border-primary bg-surface-highlight'
                  : 'border-border bg-surface'
              } hover:border-primary/50`}
            >
              <span className="flex items-center justify-between font-semibold">
                {m.label}
                {mode === m.mode && <Check size={18} className="text-primary" />}
              </span>
              <span className="block text-sm text-text-muted mt-1">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-sm space-y-1">
          <p className="font-semibold mb-2">初期設定（常時画面に表示されます）</p>
          <p>録音保存：<span className="text-success font-mono">OFF</span></p>
          <p>
            文字起こし：
            {mode === 'transcript' ? (
              <span className="text-warning font-mono">ON（保存なし）</span>
            ) : (
              <span className="text-success font-mono">OFF</span>
            )}
          </p>
          <p>クラウド送信：<span className="text-success font-mono">OFF</span></p>
          <p className="text-text-muted pt-2">
            {mode === 'balance'
              ? '発話時間は参加者ラベルごとにメモリ内で集計し、終了時に削除します。'
              : mode === 'transcript'
                ? '文字起こしメモはメモリ内のみで保持し、終了時に削除します。'
                : '終了時にすべてのデータを削除できます。'}
          </p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-4 font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {starting ? <Loader2 size={18} className="animate-spin" /> : null}
          この設定で開始する
        </button>
      </div>
    </div>
  );
}
