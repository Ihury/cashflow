import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryTrendPoint } from '../../domain/aggregations';
import { CHART_PALETTE } from '../../domain/labels';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface CategoryTrendAreaProps {
  data: CategoryTrendPoint[];
  categories: string[];
}

interface TooltipItem {
  dataKey: string;
  value: number;
  color: string;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div
      className="rounded-md px-3 py-2 text-xs min-w-[200px]"
      style={{
        background: 'var(--color-surface-lowest)',
        boxShadow: '0 4px 24px rgba(43, 52, 55, 0.1)',
      }}
    >
      <div className="text-on-surface-variant mb-1.5">{label}</div>
      {sorted.map((item) => (
        <div
          key={item.dataKey}
          className="flex items-center gap-2 py-0.5"
          style={{ color: 'var(--color-on-surface)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: item.color }}
          />
          <span className="truncate flex-1">{item.dataKey}</span>
          <span className="tabular font-semibold ml-auto">
            {formatBRL(item.value)}
          </span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-outline-variant/40 flex justify-between">
        <span className="text-on-surface-variant">Total</span>
        <span className="tabular font-semibold">{formatBRL(total)}</span>
      </div>
    </div>
  );
}

export function CategoryTrendArea({ data, categories }: CategoryTrendAreaProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 items-center">
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-outline-variant)"
              strokeDasharray="2 4"
              opacity={0.4}
            />
            <XAxis
              dataKey="monthLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            />
            <Tooltip content={<TrendTooltip />} />
            {categories.map((cat, i) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="1"
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                fillOpacity={0.85}
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 min-w-[140px] max-h-[220px] overflow-y-auto pr-2">
        {categories.map((cat, i) => (
          <li key={cat} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="text-on-surface-variant truncate flex-1">
              {cat.trim()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
