import {
  Area,
  ComposedChart,
  Bar,
  Cell,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPoint } from '../../domain/aggregations';
import { formatBRL, formatBRLCompact } from '../../format/intl';

const DAILY_COLOR = 'var(--color-expense)';
const ACC_COLOR = 'var(--color-primary)';
const AVG_INCOME_COLOR = 'var(--color-income)';
const AVG_EXPENSE_COLOR = 'var(--color-expense)';

interface DailyCumulativeLineProps {
  data: DailyPoint[];
  /** Receita média diária do mês — renderizada como linha de referência. */
  avgDailyIncome?: number;
  /** Despesa média diária do mês — renderizada como linha de referência. */
  avgDailyExpense?: number;
  selectedDate?: string | null;
  onDayClick?: (date: string | null) => void;
}

export function DailyCumulativeLine({
  data,
  avgDailyIncome,
  avgDailyExpense,
  selectedDate,
  onDayClick,
}: DailyCumulativeLineProps) {
  const interactive = !!onDayClick;
  const handleClick = (payload: { activePayload?: { payload: DailyPoint }[] } | null) => {
    if (!interactive || !payload?.activePayload?.[0]) return;
    const clicked = payload.activePayload[0].payload.date;
    onDayClick?.(clicked === selectedDate ? null : clicked);
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart
        data={data}
        margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: interactive ? 'pointer' : undefined }}
      >
        <defs>
          <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACC_COLOR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACC_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-outline-variant)"
          strokeDasharray="2 4"
          opacity={0.4}
        />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 8) - 1)}
          tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
        />
        <YAxis
          yAxisId="daily"
          orientation="left"
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatBRLCompact(v)}
          tick={{ fill: DAILY_COLOR, fontSize: 11 }}
        />
        <YAxis
          yAxisId="acc"
          orientation="right"
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatBRLCompact(v)}
          tick={{ fill: ACC_COLOR, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-low)', opacity: 0.4 }}
          content={
            <DailyTooltip
              avgDailyIncome={avgDailyIncome}
              avgDailyExpense={avgDailyExpense}
            />
          }
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}
        />
        <Bar
          yAxisId="daily"
          dataKey="daily"
          name="Diário"
          radius={[2, 2, 0, 0]}
          barSize={10}
        >
          {data.map((p) => {
            const isSelected = selectedDate === p.date;
            const isDimmed = !!selectedDate && !isSelected;
            return (
              <Cell
                key={p.date}
                fill={DAILY_COLOR}
                fillOpacity={isDimmed ? 0.2 : isSelected ? 0.95 : 0.7}
              />
            );
          })}
        </Bar>
        <Area
          yAxisId="acc"
          type="monotone"
          dataKey="accumulated"
          name="Acumulado"
          stroke={ACC_COLOR}
          strokeWidth={2}
          fill="url(#accFill)"
          activeDot={{ r: 4, fill: ACC_COLOR, strokeWidth: 0 }}
        />
        <Area
          yAxisId="acc"
          type="monotone"
          dataKey="projected"
          name="Projeção"
          stroke="var(--color-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          fill="var(--color-tertiary)"
          fillOpacity={0.08}
          activeDot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
        {avgDailyIncome !== undefined && avgDailyIncome > 0 && (
          <ReferenceLine
            yAxisId="daily"
            y={avgDailyIncome}
            stroke={AVG_INCOME_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
        )}
        {avgDailyExpense !== undefined && avgDailyExpense > 0 && (
          <ReferenceLine
            yAxisId="daily"
            y={avgDailyExpense}
            stroke={AVG_EXPENSE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  name: string;
}

function DailyTooltip({
  active,
  payload,
  label,
  avgDailyIncome,
  avgDailyExpense,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  avgDailyIncome?: number;
  avgDailyExpense?: number;
}) {
  if (!active || !payload?.length) return null;
  const colorFor = (key: string) => {
    if (key === 'daily') return DAILY_COLOR;
    if (key === 'projected') return 'var(--color-tertiary)';
    return ACC_COLOR;
  };
  const hasAvgRow =
    (avgDailyIncome !== undefined && avgDailyIncome > 0) ||
    (avgDailyExpense !== undefined && avgDailyExpense > 0);
  const visibleItems = payload.filter(
    (item) => item.dataKey !== 'projected' || (item.value != null && item.value > 0),
  );
  return (
    <div
      className="rounded-md px-3 py-2 text-xs min-w-[220px]"
      style={{
        background: 'var(--color-surface-lowest)',
        boxShadow: '0 4px 24px rgba(43, 52, 55, 0.1)',
      }}
    >
      <div className="text-on-surface-variant mb-1.5">Dia {label}</div>
      {visibleItems.map((item) => {
        const isProjection = item.dataKey === 'projected';
        return (
          <div
            key={item.dataKey}
            className={`flex items-center gap-2 py-0.5 ${isProjection ? 'opacity-70 italic' : ''}`}
            style={{ color: colorFor(item.dataKey) }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: colorFor(item.dataKey) }}
            />
            <span className="font-medium">{item.name}</span>
            <span className="ml-auto tabular font-semibold">
              {formatBRL(item.value)}
            </span>
          </div>
        );
      })}
      {hasAvgRow && (
        <div className="mt-1 pt-1.5 border-t border-outline-variant/40 space-y-0.5">
          {avgDailyIncome !== undefined && avgDailyIncome > 0 && (
            <AverageRow
              color={AVG_INCOME_COLOR}
              label="Receita média/dia"
              value={avgDailyIncome}
            />
          )}
          {avgDailyExpense !== undefined && avgDailyExpense > 0 && (
            <AverageRow
              color={AVG_EXPENSE_COLOR}
              label="Despesa média/dia"
              value={avgDailyExpense}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AverageRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ color }}>
      <span
        className="inline-block w-3 shrink-0"
        style={{ borderTop: `1.5px dashed ${color}` }}
      />
      <span className="font-medium">{label}</span>
      <span className="ml-auto tabular font-semibold">{formatBRL(value)}</span>
    </div>
  );
}
