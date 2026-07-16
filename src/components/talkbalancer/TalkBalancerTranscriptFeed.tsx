'use client';

import { useMemo } from 'react';
import { BarChart3, FileText } from 'lucide-react';
import type { TbTranscriptNote, TbTranscriptionStatus } from '@/lib/talkbalancer';
import { analyzeTranscriptNotes } from '@/lib/talkbalancer-transcript';

interface Props {
  notes: TbTranscriptNote[];
  status?: TbTranscriptionStatus | null;
  live?: boolean;
  compact?: boolean;
}

export function TalkBalancerTranscriptFeed({ notes, status, live = false, compact = false }: Props) {
  const analysis = useMemo(() => analyzeTranscriptNotes(notes), [notes]);
  const visibleNotes = useMemo(() => notes.slice(-20).reverse(), [notes]);
  const streaming = live && status?.active && ['listening', 'processing', 'starting'].includes(status.state);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <BarChart3 size={16} className="text-secondary" /> 文字起こし解析
          </h3>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <span className={`h-2 w-2 rounded-full ${streaming ? 'animate-pulse bg-success' : 'bg-slate-500'}`} />
              {streaming ? 'ライブ更新中' : '待機中'}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric label={`断片（自動${analysis.autoSegmentCount}）`} value={`${analysis.segmentCount}件`} />
          <Metric label="文字数" value={`${analysis.characterCount}`} />
          <Metric label="検出話者" value={`${analysis.speakerCount}人`} />
        </div>
        {analysis.topKeywords.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] text-text-muted">頻出語（ローカル簡易解析）</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analysis.topKeywords.map((keyword) => (
                <span key={keyword.term} className="rounded-full border border-secondary/30 bg-background/60 px-2 py-1 text-xs">
                  {keyword.term}{keyword.count > 1 ? ` ×${keyword.count}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {analysis.recentTopic && !compact && (
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            <span className="font-semibold text-white">直近の話題：</span>{analysis.recentTopic}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText size={16} className="text-primary" /> ライブ文字起こし
          </h3>
          <span className="text-[11px] text-text-muted">新しい発話が上</span>
        </div>
        {visibleNotes.length > 0 ? (
          <div className={`mt-3 space-y-2 overflow-y-auto pr-1 ${compact ? 'max-h-56' : 'max-h-96'}`} aria-live="polite">
            {visibleNotes.map((note, index) => (
              <article key={note.id} className={`rounded-lg border p-2.5 ${index === 0 && live ? 'border-secondary/40 bg-secondary/5' : 'border-border bg-surface/60'}`}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span>{note.participantName ?? '話者未指定'} ／ {note.source === 'auto' ? '自動' : '手動補正'}</span>
                  <time dateTime={note.timestamp}>{formatTranscriptTime(note.timestamp)}</time>
                </div>
                <p className="text-sm leading-relaxed">{note.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            マイク計測を開始すると、約4秒単位の文字起こしがここへ順次表示されます。
          </p>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
          最大20件を表示します。音声は保存せず、本文は開催中のメモリにだけ保持します。
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-2 py-2">
      <p className="text-base font-semibold text-secondary">{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  );
}

function formatTranscriptTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
