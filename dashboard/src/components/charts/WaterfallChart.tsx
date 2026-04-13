import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WaterfallItem } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface WaterfallChartProps {
  data: WaterfallItem[];
}

function WaterfallTick({
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
  const MAX = 14;
  const text = raw.length > MAX ? raw.slice(0, MAX - 1).trimEnd() + '…' : raw;
  return (
    <text
      x={x}
      y={y}
      dy={14}
      textAnchor="middle"
      fill="var(--color-on-surface-variant)"
      fontSize={11}
    >
      {text}
    </text>
  );
}

function colorFor(item: WaterfallItem): string {
  if (item.isTotal) return 'var(--color-on-surface-variant)';
  return item.delta > 0 ? 'var(--color-tertiary)' : 'var(--color-primary)';
}

function WaterfallTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: WaterfallItem }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="rounded-md px-3 py-2 text-xs min-w-[220px]"
      style={{
        background: 'var(--color-surface-lowest)',
        boxShadow: '0 4px 24px rgba(43, 52, 55, 0.1)',
      }}
    >
      <div className="font-medium mb-1">{item.category}</div>
      {!item.isTotal && (
        <>
          <div className="flex justify-between text-on-surface-variant">
            <span>Mês atual</span>
            <span className="tabular">{formatBRL(item.current)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Mês anterior</span>
            <span className="tabular">{formatBRL(item.previous)}</span>
          </div>
        </>
      )}
      <div className="mt-1 pt-1 border-t border-outline-variant/40 flex justify-between">
        <span className="text-on-surface-variant">Variação</span>
        <span
          className="tabular font-semibold"
          style={{ color: colorFor(item) }}
        >
          {item.delta > 0 ? '+' : ''}
          {formatBRL(item.delta)}
        </span>
      </div>
    </div>
  );
}

export function WaterfallChart({ data }: WaterfallChartProps) {
  if (!data.length) {
    return (
      <div className="text-on-surface-variant text-sm py-6 text-center">
        Sem dados do mês anterior para comparar.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-outline-variant)"
          strokeDasharray="2 4"
          opacity={0.4}
        />
        <XAxis
          dataKey="category"
          axisLine={false}
          tickLine={false}
          tick={<WaterfallTick />}
          interval={0}
          height={36}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatBRLCompact(v)}
          tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
        />
        <Tooltip cursor={{ fill: 'var(--color-surface-low)', opacity: 0.4 }} content={<WaterfallTooltip />} />
        <Bar dataKey="delta" radius={[3, 3, 3, 3]}>
          {data.map((item, i) => (
            <Cell
              key={i}
              fill={colorFor(item)}
              fillOpacity={item.isTotal ? 0.5 : 0.85}
              stroke={item.isTotal ? 'var(--color-on-surface-variant)' : 'none'}
              strokeDasharray={item.isTotal ? '4 4' : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
