'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface RunRecord {
  id: number;
  task_id: string;
  baseline_id: string;
  executed_at: string;
  success: boolean;
  total_tokens: number;
  step_count: number;
  retry_count: number;
  metrics?: Record<string, unknown> | null;
}

interface TrendChartProps {
  runs: RunRecord[];
  metricKey: string;
  label?: string;
}

const METRIC_LABELS: Record<string, string> = {
  total_tokens: 'Total Tokens',
  input_tokens: 'Input Tokens',
  output_tokens: 'Output Tokens',
  step_count: 'Steps',
  retry_count: 'Retries',
  sus_inspired_score: 'SUS Score',
};

function formatMetricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getValue(run: RunRecord, key: string): number | null {
  if (key === 'total_tokens') return run.total_tokens;
  if (key === 'step_count') return run.step_count;
  if (key === 'retry_count') return run.retry_count;
  const v = run.metrics?.[key];
  return typeof v === 'number' ? v : null;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: RunRecord }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const run = payload[0].payload;
  return (
    <div className="bg-surface border border-white/10 rounded-lg p-3 text-sm shadow-xl min-w-[180px]">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className="text-white font-mono font-semibold text-base">
        {payload[0].value.toLocaleString()}
      </p>
      <div className="border-t border-white/5 mt-2 pt-2 space-y-1">
        <p className="text-text-muted text-xs">
          Baseline: <span className="text-primary">{run.baseline_id}</span>
        </p>
        <p className="text-text-muted text-xs">
          Status:{' '}
          <span className={run.success ? 'text-success' : 'text-error'}>
            {run.success ? 'Success' : 'Failed'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default function TrendChart({ runs, metricKey, label }: TrendChartProps) {
  // Sort ascending by date so trend reads left-to-right
  const sorted = [...runs].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
  );

  const data = sorted
    .map(run => ({
      ...run,
      value: getValue(run, metricKey),
      time: new Date(run.executed_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }))
    .filter(d => d.value !== null);

  const values = data.map(d => d.value as number);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const chartLabel = label ?? formatMetricLabel(metricKey);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              label={{
                value: `avg ${avg >= 1000 ? `${(avg / 1000).toFixed(1)}k` : avg.toFixed(1)}`,
                fill: '#94a3b8',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            name={chartLabel}
            stroke="#00f2ff"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  key={`dot-${payload.id}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={payload.success ? '#00f2ff' : '#ff0055'}
                  stroke="#050510"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 6, fill: '#00f2ff', stroke: '#050510', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
