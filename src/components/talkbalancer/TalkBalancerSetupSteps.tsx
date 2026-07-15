import { Check } from 'lucide-react';

const STEPS = [
  { number: 1, label: 'ルール共有', detail: '全員へ説明' },
  { number: 2, label: 'モード選択', detail: '同意を確認' },
  { number: 3, label: 'マイク開始', detail: '置いて使う' },
] as const;

export function TalkBalancerSetupSteps({ current }: { current?: 1 | 2 | 3 }) {
  return (
    <ol aria-label="開始までの3ステップ" className="grid grid-cols-3 gap-2">
      {STEPS.map((step) => {
        const completed = current !== undefined && step.number < current;
        const active = current === step.number;
        return (
          <li
            key={step.number}
            className={`rounded-xl border px-2 py-3 text-center ${
              active
                ? 'border-primary bg-primary/10'
                : completed
                  ? 'border-success/30 bg-success/5'
                  : 'border-border bg-surface'
            }`}
          >
            <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              active ? 'bg-primary text-black' : completed ? 'bg-success text-black' : 'bg-background text-text-muted'
            }`}>
              {completed ? <Check size={14} /> : step.number}
            </span>
            <span className="mt-2 block text-xs font-semibold sm:text-sm">{step.label}</span>
            <span className="mt-0.5 block text-[10px] text-text-muted sm:text-xs">{step.detail}</span>
          </li>
        );
      })}
    </ol>
  );
}
