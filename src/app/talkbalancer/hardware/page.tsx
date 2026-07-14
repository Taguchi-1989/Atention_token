import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Info,
  Laptop,
  PackageCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  COMPATIBILITY_NOTES,
  KIT_TIERS,
  MIC_CANDIDATES,
} from '@/lib/talkbalancer-guides';

const recommendationStyle: Record<string, string> = {
  標準候補: 'border-primary/50 bg-primary/10 text-primary',
  安価な標準候補: 'border-success/40 bg-success/10 text-success',
  上位候補: 'border-secondary/50 bg-secondary/10 text-secondary',
  検証候補: 'border-warning/50 bg-warning/10 text-warning',
  非標準候補: 'border-border bg-background/40 text-text-muted',
};

export default function HardwareGuidePage() {
  return (
    <div className="min-h-screen bg-background p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-8 py-6">
        <Link href="/talkbalancer" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white">
          <ArrowLeft size={16} /> TalkBalancer
        </Link>

        <header className="space-y-3">
          <p className="text-sm tracking-widest text-primary">Hardware Selection</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">機器選定ガイド</h1>
              <p className="mt-2 max-w-2xl text-text-muted">
                標準はスマホ用の高音質マイクではなく、テーブル中央に置ける会議用スピーカーフォンです。
                まずUSB接続で外部マイク認識と音量メーターを確認します。
              </p>
            </div>
            <Link
              href="/talkbalancer/mic"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
            >
              マイク確認へ <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <PackageCheck size={18} className="text-primary" /> まず検証するなら
          </h2>
          <p className="text-sm leading-relaxed text-text-muted">
            USB-C有線入力の初期確認は <span className="font-semibold text-white">Audio-Technica ATR4697-USB</span> を使います。
            標準配布候補の <span className="font-semibold text-white">Jabra Speak2 55</span> と
            <span className="font-semibold text-white"> Anker PowerConf S3</span> は、対象タブレットのブラウザで
            マイク入力として認識できることを実機確認してから採用します。
          </p>
        </section>

        <section className="rounded-xl border border-warning/40 bg-warning/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Laptop size={19} className="text-warning" /> 機材が手元にない場合
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
                PC内蔵マイクでも <span className="font-semibold text-white">簡易モード</span> として開始できます。
                外部マイクより収音の公平性と再現性は下がりますが、同じPCを同じ場所に置けば、店内音量の変化を
                0〜100の相対値とdBFS参考値で確認できます。
              </p>
            </div>
            <Link
              href="/talkbalancer/mic"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-warning/60 bg-warning/10 px-5 py-3 text-sm font-semibold text-white hover:bg-warning/20"
            >
              <Gauge size={16} /> 内蔵マイクを試す
            </Link>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-background/40 p-3">
              <p className="font-semibold text-white">1. PCを中央寄りに置く</p>
              <p className="mt-1 text-text-muted">壁際や一人の近くを避け、途中で位置を変えません。</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-background/40 p-3">
              <p className="font-semibold text-white">2. 開始前に10秒ずつ確認</p>
              <p className="mt-1 text-text-muted">静かな状態と通常会話で、相対数値の差を見ます。</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-background/40 p-3">
              <p className="font-semibold text-white">3. 絶対dBとして扱わない</p>
              <p className="mt-1 text-text-muted">端末やOSの自動ゲインで変わるため、その場の変化を見る目安です。</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {KIT_TIERS.map((kit) => {
            const Icon = kit.icon;
            return (
              <article key={kit.name} className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <span className="rounded-full border border-primary/40 px-2 py-1 text-xs text-primary">
                    {kit.badge}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">{kit.name}</h2>
                <p className="mt-1 text-sm text-text-muted">{kit.bestFor}</p>
                <p className="mt-3 text-sm">
                  推奨マイク：<span className="font-semibold text-white">{kit.primaryMic}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {kit.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-text-muted">
                  {kit.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <PackageCheck size={20} className="text-primary" /> マイク候補
          </h2>
          <div className="grid gap-4">
            {MIC_CANDIDATES.map((mic) => (
              <article key={mic.name} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border px-2 py-1 text-xs text-text-muted">
                        {mic.rank}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-xs ${recommendationStyle[mic.recommendation]}`}>
                        {mic.recommendation}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{mic.name}</h3>
                    <p className="mt-1 text-sm text-text-muted">{mic.fit}</p>
                  </div>
                  <a
                    href={mic.sourceUrl}
                    target={mic.sourceUrl.startsWith('http') ? '_blank' : undefined}
                    rel={mic.sourceUrl.startsWith('http') ? 'noreferrer' : undefined}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {mic.sourceLabel} <ExternalLink size={14} />
                  </a>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-success">強み</p>
                    <ul className="space-y-2 text-sm">
                      {mic.strengths.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-warning">注意点</p>
                    <ul className="space-y-2 text-sm text-text-muted">
                      {mic.cautions.map((item) => (
                        <li key={item} className="flex gap-2">
                          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-warning" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Info size={18} className="text-primary" /> 接続互換性メモ
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {COMPATIBILITY_NOTES.map((note) => (
              <a
                key={note.title}
                href={note.sourceUrl}
                target={note.sourceUrl.startsWith('http') ? '_blank' : undefined}
                rel={note.sourceUrl.startsWith('http') ? 'noreferrer' : undefined}
                className="rounded-lg border border-border bg-background/40 p-4 text-sm hover:border-primary/50"
              >
                <span className="mb-2 flex items-center justify-between gap-2 font-semibold text-white">
                  {note.title}
                  <ExternalLink size={14} className="text-primary" />
                </span>
                <span className="block leading-relaxed text-text-muted">{note.text}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
