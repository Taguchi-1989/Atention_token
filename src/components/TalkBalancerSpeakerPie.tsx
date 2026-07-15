'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TbSpeakerSlice } from '@/lib/talkbalancer';

interface Props {
  title: string;
  data: TbSpeakerSlice[];
  totalSeconds: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min}分${sec}秒` : `${min}分`;
}

export default function TalkBalancerSpeakerPie({ title, data, totalSeconds }: Props) {
  const chartData = data.filter((item) => item.seconds > 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs font-mono text-text-muted">{formatDuration(totalSeconds)}</span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
          話者記録はまだありません
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="seconds"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.participantId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatDuration(Number(value)), name]}
                  contentStyle={{
                    background: '#0f1525',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.map((item) => (
              <div key={item.participantId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-mono text-text-muted">
                    {Math.round(item.share * 100)}% / {formatDuration(item.seconds)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.round(item.share * 100)}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
