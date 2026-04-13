import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyBar } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface MonthlyEvolutionBarsProps {
  data: MonthlyBar[];
  onBarClick?: (monthKey: string) => void;
}

export function MonthlyEvolutionBars({ data, onBarClick }: MonthlyEvolutionBarsProps) {
  const handleClick = (state: { activeLabel?: string | number } | null) => {
    if (!onBarClick || !state?.activeLabel) return;
    const bar = data.find((d) => d.monthLabel === state.activeLabel);
    if (bar) onBarClick(bar.monthKey);
  };

  return (
    <div>
      <div className="flex items-center gap-5 mb-3 text-label uppercase">
        <LegendDot color="var(--color-primary)" label="Receitas" />
        <LegendDot color="var(--color-tertiary)" label="Gastos" />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 0, left: -10, bottom: 0 }}
          barCategoryGap={20}
          onClick={onBarClick ? handleClick : undefined}
          style={onBarClick ? { cursor: 'pointer' } : undefined}
        >
          <XAxis
            dataKey="monthLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatBRLCompact(v)}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            width={56}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-low)', opacity: 0.6 }}
            contentStyle={{
              background: 'var(--color-surface-lowest)',
              border: 'none',
              borderRadius: 6,
              boxShadow: '0 4px 24px rgba(43, 52, 55, 0.06)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-on-surface-variant)', fontSize: 11, textTransform: 'uppercase' }}
            formatter={(v: number, name) => [formatBRL(v), name === 'receitas' ? 'Receitas' : 'Gastos']}
          />
          <Bar dataKey="receitas" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="gastos" fill="var(--color-tertiary)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
