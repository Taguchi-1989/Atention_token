'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

interface MetricsChartProps {
  baselineA: Record<string, number>;
  baselineB: Record<string, number>;
  metricKeys: string[];
  labelA?: string;
  labelB?: string;
}

interface ChartEntry {
  metric: string;
  A: number;
  B: number;
  delta: string;
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

function computeDelta(a: number, b: number): string {
  if (a === 0) return b === 0 ? '0%' : '+∞%';
  const pct = ((b - a) / Math.abs(a)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// Custom label that renders the delta percentage above the B bar
function DeltaLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: string;
}) {
  const { x = 0, y = 0, width = 0, value } = props;
  if (!value) return null;
  const isPositive = value.startsWith('+') && value !== '+0.0%';
  const isNegative = value.startsWith('-');
  const color = isNegative ? '#00ff9d' : isPositive ? '#ff0055' : '#94a3b8';
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill={color}
      fontSize={10}
      textAnchor="middle"
      fontFamily="monospace"
    >
      {value}
    </text>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-white/10 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          <span className="text-text-muted">{entry.name}:</span>
          <span className="text-white font-mono">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function MetricsChart({
  baselineA,
  baselineB,
  metricKeys,
  labelA = 'Baseline A',
  labelB = 'Baseline B',
}: MetricsChartProps) {
  const data: ChartEntry[] = metricKeys.map(key => {
    const a = baselineA[key] ?? 0;
    const b = baselineB[key] ?? 0;
    return {
      metric: formatMetricLabel(key),
      A: a,
      B: b,
      delta: computeDelta(a, b),
    };
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 16, left: 8, bottom: 8 }}
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="metric"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
            formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
          <Bar dataKey="A" name={labelA} fill="#00f2ff" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
          <Bar dataKey="B" name={labelB} fill="#7000ff" fillOpacity={0.85} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="delta" content={<DeltaLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
