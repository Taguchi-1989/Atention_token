import { ShieldCheck } from 'lucide-react';
import { SessionMode, TbPrivacy, TB_MODE_LABELS, derivePrivacy } from '@/lib/talkbalancer';

// 10.1 プライバシー: 録音保存 / 文字起こし / クラウド送信 の3行と現在の解析モードを
// 常時表示するための共有コンポーネント。全 TalkBalancer 画面のフッター等に常設する。
interface PrivacyBarProps {
  // 現在の解析モード。null/undefined はセッション未開始（既定=全OFF・「未開始」表示）。
  mode?: SessionMode | null;
  // サーバー由来のプライバシー値で上書きする（report 画面用）。省略時は mode から導出。
  privacy?: TbPrivacy | null;
  // card=枠付きブロック（consent/report 向け）、footer=常設フッター（既定）。
  variant?: 'card' | 'footer';
  className?: string;
}

function Value({ on }: { on: boolean }) {
  return (
    <span className={`font-mono ${on ? 'text-warning' : 'text-success'}`}>{on ? 'ON' : 'OFF'}</span>
  );
}

export function PrivacyBar({ mode, privacy, variant = 'footer', className = '' }: PrivacyBarProps) {
  const p = privacy ?? derivePrivacy(mode);
  const modeLabel = mode ? TB_MODE_LABELS[mode] : '未開始';

  if (variant === 'card') {
    return (
      <div className={`rounded-xl border border-border bg-surface p-4 text-sm space-y-1 ${className}`}>
        <p className="font-semibold mb-2">プライバシー設定（常時画面に表示されます）</p>
        <p>録音保存：<Value on={p.recording} /></p>
        <p>文字起こし：<Value on={p.transcription} /></p>
        <p>クラウド送信：<Value on={p.cloudUpload} /></p>
        <p>解析モード：<span className="font-mono">{modeLabel}</span></p>
        <p className="text-text-muted pt-2">終了時にすべてのデータを削除できます。</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-muted ${className}`}>
      <ShieldCheck size={14} className="text-success shrink-0" />
      <span>録音保存：<Value on={p.recording} /></span>
      <span>文字起こし：<Value on={p.transcription} /></span>
      <span>クラウド送信：<Value on={p.cloudUpload} /></span>
      <span>解析モード：<span className="font-mono">{modeLabel}</span></span>
    </div>
  );
}
