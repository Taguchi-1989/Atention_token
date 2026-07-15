import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { PARTY_PHASES, SETUP_CHECKLIST, TRIGGER_CARDS } from '@/lib/talkbalancer-guides';

const toneClass = {
  primary: 'border-primary/40 bg-primary/5 text-primary',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  error: 'border-error/50 bg-error/10 text-error',
  success: 'border-success/40 bg-success/10 text-success',
};

export default function PartyGuidePage() {
  return (
    <div className="min-h-screen bg-background p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-8 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>

        <header className="space-y-3">
          <p className="text-sm tracking-widest text-primary">Party Operation</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">飲み会運用ガイド</h1>
              <p className="mt-2 max-w-2xl text-text-muted">
                TalkBalancerは、注意する人を作らずに場の合図を出すための道具です。
                開始前に合意を作り、酒が入った後は幹事リモコンで丁重に流れを整えます。
              </p>
            </div>
            <Link
              href="/talkbalancer/declaration"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
            >
              開始前宣言へ <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          {PARTY_PHASES.map((phase) => {
            const Icon = phase.icon;
            return (
              <article key={phase.title} className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <span className="rounded-full border border-border px-2 py-1 text-xs text-text-muted">
                    {phase.timing}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">{phase.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{phase.goal}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {phase.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <ClipboardList size={18} className="text-primary" /> 当日のセットアップ
            </h2>
            <div className="grid gap-3">
              {SETUP_CHECKLIST.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-sm">
                    <Icon size={17} className="shrink-0 text-primary" />
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Megaphone size={18} className="text-primary" /> 幹事の出し分け
            </h2>
            <div className="grid gap-3">
              {TRIGGER_CARDS.map((trigger) => (
                <article key={trigger.title} className={`rounded-lg border p-4 ${toneClass[trigger.tone]}`}>
                  <h3 className="font-semibold text-white">{trigger.title}</h3>
                  <p className="mt-2 text-sm text-text-muted">{trigger.signal}</p>
                  <p className="mt-3 text-sm font-medium">{trigger.action}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-success/30 bg-success/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-success">
            <ShieldCheck size={18} /> 運用ルール
          </h2>
          <div className="grid gap-3 text-sm text-text-muted sm:grid-cols-3">
            <p className="flex gap-2">
              <Timer size={16} className="mt-0.5 shrink-0 text-success" />
              アラートは短く出し、説明しすぎない。
            </p>
            <p className="flex gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
              個人名を出さず、場全体への合図として扱う。
            </p>
            <p className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
              終了時にレポート確認後、データを削除する。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
