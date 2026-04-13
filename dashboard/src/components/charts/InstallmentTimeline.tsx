import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FutureInstallment } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface InstallmentTimelineProps {
  data: {
    totalFutureCommitted: number;
    monthsAhead: FutureInstallment[];
  };
}

function InstallmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FutureInstallment }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="rounded-md px-3 py-2 text-xs min-w-[260px]"
      style={{
        background: 'var(--color-surface-lowest)',
        boxShadow: '0 4px 24px rgba(43, 52, 55, 0.1)',
      }}
    >
      <div className="font-medium mb-1">{item.monthLabel}</div>
      <div className="flex justify-between text-on-surface-variant mb-2">
        <span>Total comprometido</span>
        <span className="tabular font-semibold">
          {formatBRL(item.totalCommitted)}
        </span>
      </div>
      <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
        {item.items.slice(0, 8).map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-on-surface-variant"
          >
            <span className="truncate flex-1">{it.description}</span>
            <span className="tabular opacity-80">{it.currentOfTotal}</span>
            <span className="tabular font-semibold">{formatBRL(it.amount)}</span>
          </div>
        ))}
        {item.items.length > 8 && (
          <div className="text-on-surface-variant text-[10px] text-right mt-1">
            +{item.items.length - 8} mais
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallmentTimeline({ data }: InstallmentTimelineProps) {
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6">
        <div>
          <div className="text-label uppercase text-on-surface-variant">
            Total Comprometido em Parcelas
          </div>
          <div className="tabular text-[2rem] font-semibold tracking-tight text-on-surface mt-1">
            {formatBRL(data.totalFutureCommitted)}
          </div>
        </div>
        <div className="text-label uppercase text-on-surface-variant ml-auto">
          Próximos {data.monthsAhead.length} meses
        </div>
      </div>
      {data.monthsAhead.length === 0 ? (
        <div className="text-on-surface-variant text-sm py-6 text-center">
          Nenhuma parcela futura em aberto.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data.monthsAhead}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
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
              width={64}
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: 'var(--color-surface-low)', opacity: 0.4 }} content={<InstallmentTooltip />} />
            <Bar
              dataKey="totalCommitted"
              fill="var(--color-tertiary)"
              radius={[3, 3, 0, 0]}
            >
              {data.monthsAhead.map((_item, i) => {
                const opacity = Math.max(0.35, 1 - (i / data.monthsAhead.length) * 0.65);
                return <Cell key={i} fill="var(--color-tertiary)" fillOpacity={opacity} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
