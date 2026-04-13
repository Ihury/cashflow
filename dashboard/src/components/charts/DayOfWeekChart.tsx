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
import type { DayOfWeekSlice } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface DayOfWeekChartProps {
  data: DayOfWeekSlice[];
}

function DowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DayOfWeekSlice }[];
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
      <div className="font-medium mb-1">{item.dayLabel}</div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Total</span>
        <span className="tabular">{formatBRL(item.totalExpense)}</span>
      </div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Média por dia</span>
        <span className="tabular font-semibold">{formatBRL(item.avgExpense)}</span>
      </div>
      <div className="flex justify-between text-on-surface-variant">
        <span>Transações</span>
        <span className="tabular">{item.count}</span>
      </div>
    </div>
  );
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const max = data.reduce((m, d) => Math.max(m, d.totalExpense), 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-outline-variant)"
          strokeDasharray="2 4"
          opacity={0.4}
        />
        <XAxis
          dataKey="dayLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatBRLCompact(v)}
          tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
        />
        <Tooltip cursor={{ fill: 'var(--color-surface-low)', opacity: 0.4 }} content={<DowTooltip />} />
        <Bar dataKey="totalExpense" name="Total" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => {
            const intensity = max > 0 ? 0.35 + (d.totalExpense / max) * 0.65 : 0.5;
            return (
              <Cell
                key={i}
                fill="var(--color-primary)"
                fillOpacity={intensity}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
