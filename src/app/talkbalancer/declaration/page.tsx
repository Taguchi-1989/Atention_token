'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DECLARATION_LINES } from '@/lib/talkbalancer';

// F-01 開始前宣言
export default function DeclarationPage() {
  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <p className="text-primary text-sm tracking-widest">TalkBalancer ─ 開始前宣言</p>

        <h1 className="text-2xl sm:text-4xl font-bold leading-relaxed">
          今日は、全員が気持ちよく話せる
          <br />
          飲み会にします。
        </h1>

        <ul className="mx-auto max-w-xl space-y-3 text-left">
          {DECLARATION_LINES.map((line) => (
            <li
              key={line}
              className="rounded-xl border border-border bg-surface px-5 py-3 text-base sm:text-lg"
            >
              ・{line}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/talkbalancer"
            className="inline-flex items-center gap-1 rounded-xl border border-border px-5 py-3 text-text-muted hover:text-white"
          >
            <ArrowLeft size={18} /> 戻る
          </Link>
          <Link
            href="/talkbalancer/consent"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-black hover:opacity-90"
          >
            同意確認へ進む <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
