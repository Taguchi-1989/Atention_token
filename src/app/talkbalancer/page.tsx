'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wine,
  Megaphone,
  MonitorSpeaker,
  Mic,
  ScrollText,
  Trash2,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  PackageCheck,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Laptop,
} from 'lucide-react';
import { fetchTbSession, endTbSession, isDemoMode, SessionState } from '@/lib/talkbalancer';
import { PrivacyBar } from '@/components/talkbalancer/PrivacyBar';
import { TalkBalancerSetupSteps } from '@/components/talkbalancer/TalkBalancerSetupSteps';

const MODE_LABELS: Record<string, string> = {
  volume_only: 'モードA：音量のみ',
  balance: 'モードB：音量＋発話バランス',
  transcript: 'モードC：ローカル文字起こし＋自動話者',
};

export default function TalkBalancerHome() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [apiError, setApiError] = useState(false);
  const [demo, setDemo] = useState(false);

  const load = useCallback(() => {
    fetchTbSession()
      .then((s) => { setState(s); setApiError(false); setDemo(isDemoMode()); })
      .catch(() => setApiError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEnd = async () => {
    if (!window.confirm('セッションを終了し、データを削除しますか？')) return;
    await endTbSession();
    load();
  };

  const beginSetup = (target: 'mobile' | 'table') => {
    window.localStorage.setItem('talkbalancer.startTarget', target);
    window.localStorage.setItem('talkbalancer.startTargetAt', String(Date.now()));
    router.push('/talkbalancer/declaration');
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

        {demo && (
          <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm">
            <p className="font-semibold text-secondary mb-1">デモモードで動作中</p>
            <p className="text-text-muted">
              サーバー未接続のため、データはこのブラウザ内にのみ保存されます。
              テーブル表示と幹事リモコンを同じブラウザの別タブで開くと連携を体験できます。
              携帯1台モードなら、同じ画面内で表示と操作ができます。
              騒音メーターもブラウザ内で解析され、音声は端末から送信されません。
            </p>
          </div>
        )}

        {state?.active && state.session ? (
          <section className="space-y-4 rounded-2xl border border-success/40 bg-success/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-widest text-success">開催中</p>
                <h2 className="mt-1 text-xl font-bold">{state.session.title}</h2>
                <p className="mt-1 text-sm text-text-muted">{MODE_LABELS[state.session.mode]}</p>
              </div>
              <span className="mt-1 h-3 w-3 animate-pulse rounded-full bg-success" aria-label="セッション稼働中" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryLink href="/talkbalancer/mobile" icon={<Smartphone size={19} />} title="この端末で進行する" />
              <PrimaryLink href="/talkbalancer/table" icon={<MonitorSpeaker size={19} />} title="テーブル画面を開く" />
            </div>
            <Link href="/talkbalancer/remote" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <Megaphone size={16} /> 幹事リモコンを開く <ArrowRight size={14} />
            </Link>
            <PrivacyBar mode={state.session.mode} />
            <button onClick={handleEnd} className="inline-flex items-center gap-1 text-xs text-error hover:underline">
              <Trash2 size={14} /> 終了してデータを削除
            </button>
          </section>
        ) : (
          <>
            <section className="space-y-5 rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-surface p-5 shadow-glow">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary">初めての方はここから</p>
                <h2 className="mt-2 text-2xl font-bold">使い方を1つ選ぶだけ</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">どちらも、ルール共有 → モード選択 → マイク開始の3段階です。</p>
              </div>

              <TalkBalancerSetupSteps />

              <div className="grid gap-3">
                <button onClick={() => beginSetup('mobile')} className="group rounded-xl border border-primary/50 bg-primary/10 p-4 text-left hover:bg-primary/15">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-black"><Smartphone size={23} /></span>
                      <span><span className="block font-bold">スマホ1台で始める</span><span className="mt-1 block text-xs text-text-muted">音量・通知ならスマホだけで利用可能</span></span>
                    </span>
                    <ArrowRight size={20} className="text-primary transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
                <button onClick={() => beginSetup('table')} className="group rounded-xl border border-secondary/40 bg-secondary/5 p-4 text-left hover:bg-secondary/10">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-white"><Laptop size={23} /></span>
                      <span><span className="block font-bold">PC・複数画面で始める</span><span className="mt-1 block text-xs text-text-muted">文字起こし・話者識別はこちら</span></span>
                    </span>
                    <ArrowRight size={20} className="text-secondary transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">始める前に知るのは、この3点だけ</h2>
              <ul className="mt-3 space-y-2 text-sm text-text-muted">
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /><span>外付けマイクは不要。スマホまたはPCの内蔵マイクで開始できます。</span></li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /><span>文字起こし・話者識別を使うモードCだけ、ローカルPCが必要です。</span></li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /><span>録音保存とクラウド音声送信は常にOFFです。</span></li>
              </ul>
            </section>
          </>
        )}

        <details className="group rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">
            ガイド・設定・レポート
            <ChevronDown size={17} className="text-text-muted transition-transform group-open:rotate-180" />
          </summary>
          <nav className="grid gap-2 border-t border-border p-3">
            <MenuLink href="/talkbalancer/party" icon={<ClipboardList size={19} />} title="飲み会運用ガイド" desc="当日の流れを確認" />
            <MenuLink href="/talkbalancer/hardware" icon={<PackageCheck size={19} />} title="機器・話者識別ガイド" desc="必要機材と精度を図で確認" />
            <MenuLink href="/talkbalancer/mic" icon={<Mic size={19} />} title="マイク接続確認" desc="入力デバイスをテスト" />
            <MenuLink href="/talkbalancer/declaration" icon={<ScrollText size={19} />} title="開始前宣言だけ開く" desc="参加者へルールを共有" />
            <MenuLink href="/talkbalancer/report" icon={<BarChart3 size={19} />} title="終了レポート" desc="開催中の状態を確認" />
          </nav>
        </details>
      </div>
    </div>
  );
}

function PrimaryLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-black hover:opacity-90">{icon}{title}</Link>;
}

function MenuLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 hover:border-primary/50 hover:bg-surface-highlight transition-colors"
    >
      <span className="text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-text-muted">{desc}</span>
      </span>
    </Link>
  );
}
