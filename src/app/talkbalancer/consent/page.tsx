'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { startTbSession, getTbAgreedAt, SessionMode } from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';
import { TalkBalancerSetupSteps } from '@/components/talkbalancer/TalkBalancerSetupSteps';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
    label: 'モードC：ローカル文字起こし＋自動話者',
    desc: '短い音声断片を自宅PCで一時処理し、文字起こしと現在話者を表示します（録音保存・クラウド送信なし）',
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
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [agreedChecked, setAgreedChecked] = useState(false);
  const [localAudioAgreed, setLocalAudioAgreed] = useState(false);

  // hydration不一致回避のため初期描画では判定せず、マウント後にsessionStorageを読む
  useEffect(() => {
    setAgreedAt(getTbAgreedAt());
    setAgreedChecked(true);
  }, []);

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
      await startTbSession(title || '飲み会', mode, names, agreedAt);
      const startTarget = window.localStorage.getItem('talkbalancer.startTarget');
      const requestedAt = Number(window.localStorage.getItem('talkbalancer.startTargetAt'));
      window.localStorage.removeItem('talkbalancer.startTarget');
      window.localStorage.removeItem('talkbalancer.startTargetAt');
      const mobileRequested = startTarget === 'mobile'
        && Number.isFinite(requestedAt)
        && Date.now() - requestedAt < 30 * 60 * 1000;
      router.push(mobileRequested ? '/talkbalancer/mobile' : '/talkbalancer/mic');
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

        <TalkBalancerSetupSteps current={2} />

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

        {mode !== 'volume_only' && (
          <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div>
              <h2 className="font-semibold">参加者を設定</h2>
              <p className="mt-1 text-sm text-text-muted">
                {mode === 'transcript'
                  ? '最初は「話者1」などで自動識別し、幹事画面で参加者名へ一度対応づけます。'
                  : '発話時間を記録するときに使う名前です。参加者向け画面には表示しません。'}
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
        )}

        {mode === 'transcript' && (
          <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <h2 className="font-semibold">モードCでできること・できないこと</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                事前の声登録なしで話者を約3秒ごとに識別します。ただし、同時に重なった声を別々の音声へ分離する機能ではありません。
                AI処理にはローカルPCが必要で、外付けマイクは任意です。
              </p>
            </div>
            <Image
              src={`${basePath}/manual/talkbalancer-v0.4/10-speaker-identification-limits.png`}
              alt="順番に話す人の識別には対応し、同時発話の音源分離には対応していないことを示す図"
              width={1664}
              height={935}
              unoptimized
              className="h-auto w-full rounded-lg border border-white/10"
            />
            <Link href="/talkbalancer/hardware" className="inline-flex text-sm font-semibold text-primary hover:underline">
              機器構成と精度の説明を詳しく見る
            </Link>
          </section>
        )}

        <PrivacyBar mode={mode} variant="card" />
        {mode === 'transcript' && (
          <label className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-secondary/5 p-4 text-sm">
            <input
              type="checkbox"
              checked={localAudioAgreed}
              onChange={(event) => setLocalAudioAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-400"
            />
            <span>
              <span className="block font-semibold">ローカル音声解析に同意します</span>
              <span className="mt-1 block leading-relaxed text-text-muted">音声は自宅PCへ一時送信され、メモリ上の短い断片として処理後に破棄されます。録音ファイルとクラウド送信はありません。</span>
            </span>
          </label>
        )}
        {mode !== 'volume_only' && (
          <p className="text-xs text-text-muted">
            {mode === 'balance'
              ? '発話時間は参加者ラベルごとにメモリ内で集計し、終了時に削除します。'
              : '文字だけをセッション中のメモリに保持し、生音声は短時間処理後に破棄します。'}
          </p>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting || (agreedChecked && !agreedAt) || (mode === 'transcript' && !localAudioAgreed)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-4 font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {starting ? <Loader2 size={18} className="animate-spin" /> : null}
          この設定で開始する
        </button>
      </div>
    </div>
  );
}
