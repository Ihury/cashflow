import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CounterpartSlice } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact, formatPercent } from '../../format/intl';

interface CounterpartRankingProps {
  data: CounterpartSlice[];
}

function TruncatedTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  if (!payload) return null;
  const raw = payload.value ?? '';
  const MAX = 22;
  const text = raw.length > MAX ? raw.slice(0, MAX - 1).trimEnd() + '…' : raw;
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="end"
      fill="var(--color-on-surface)"
      fontSize={11}
    >
      {text}
    </text>
  );
}

function CpTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CounterpartSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="rounded-md px-3 py-2 text-xs min-w-[200px]"
      style={{
        background: 'var(--color-surface-lowest)',
        boxShadow: '0 4px 24px rgba(43, 52, 55, 0.1)',
      }}
    >
      <div className="font-medium mb-1 truncate">{item.counterpart}</div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Total</span>
        <span className="tabular font-semibold">{formatBRL(item.total)}</span>
      </div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Transações</span>
        <span className="tabular">{item.count}</span>
      </div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Participação</span>
        <span className="tabular">{formatPercent(item.share)}</span>
      </div>
    </div>
  );
}

export function CounterpartRanking({ data }: CounterpartRankingProps) {
  if (!data.length) {
    return (
      <div className="text-on-surface-variant text-sm py-6 text-center">
        Sem dados suficientes para ranking.
      </div>
    );
  }
  const height = Math.max(200, data.length * 28);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--color-outline-variant)"
          strokeDasharray="2 4"
          opacity={0.4}
        />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatBRLCompact(v)}
          tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
        />
        <YAxis
          dataKey="counterpart"
          type="category"
          axisLine={false}
          tickLine={false}
          width={180}
          tick={<TruncatedTick />}
          interval={0}
        />
        <Tooltip cursor={{ fill: 'var(--color-surface-low)', opacity: 0.4 }} content={<CpTooltip />} />
        <Bar
          dataKey="total"
          fill="var(--color-primary)"
          radius={[0, 3, 3, 0]}
          barSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
