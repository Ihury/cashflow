import { useEffect, useMemo, useState } from 'react';
import { useTransactions } from '../data/useTransactions';
import { applyMode, type Mode } from '../domain/modes';
import {
  availableMonths,
  availableYears,
  filterByMonth,
} from '../domain/periods';
import { subMonths } from 'date-fns';
import {
  computeDeltaKPIs,
  computeExpenseByCategory,
  computeIncomeByCategory,
  computeDailyCumulative,
  computeDailyAverages,
  withBurnProjection,
  computeRecurringVsVariable,
  computeMonthWaterfall,
  computeExpenseBySource,
} from '../domain/aggregations';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { KPICard } from '../components/kpi/KPICard';
import { KPICardHighlighted } from '../components/kpi/KPICardHighlighted';
import { ChartCard } from '../components/charts/ChartCard';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { DailyCumulativeLine } from '../components/charts/DailyCumulativeLine';
import { WaterfallChart } from '../components/charts/WaterfallChart';
import { SourceBar } from '../components/charts/SourceBar';
import { TransactionsLedger } from '../components/table/TransactionsLedger';
import { MonthPicker } from '../components/pickers/MonthPicker';
import { formatMonthYear, formatPercent } from '../format/intl';

interface VisaoMensalProps {
  mode: Mode;
  month: Date | null;
  onMonthChange: (date: Date) => void;
}

export function VisaoMensal({ mode, month: monthProp, onMonthChange }: VisaoMensalProps) {
  const txs = useTransactions();

  // Default month: latest available
  const allMonths = useMemo(() => {
    const all: Date[] = [];
    for (const y of availableYears(txs)) all.push(...availableMonths(txs, y));
    return all;
  }, [txs]);

  const month = monthProp ?? allMonths[allMonths.length - 1] ?? new Date();
  const [categoryFilter, setCategoryFilter] = useState<{
    label: string;
    categories: string[];
  } | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });

  const monthTxs = useMemo(() => filterByMonth(txs, month), [txs, month]);
  const prevMonthTxs = useMemo(
    () => filterByMonth(txs, subMonths(month, 1)),
    [txs, month],
  );

  const filtered = useMemo(() => applyMode(monthTxs, mode), [monthTxs, mode]);
  const txIndex = useMemo(() => new Map(filtered.map((t) => [t.id, t])), [filtered]);
  const filteredPrev = useMemo(
    () => applyMode(prevMonthTxs, mode),
    [prevMonthTxs, mode],
  );

  const kpis = useMemo(
    () => computeDeltaKPIs(filtered, filteredPrev),
    [filtered, filteredPrev],
  );

  const recurringSplit = useMemo(() => computeRecurringVsVariable(filtered), [filtered]);
  const waterfall = useMemo(
    () => computeMonthWaterfall(filtered, filteredPrev, 8),
    [filtered, filteredPrev],
  );
  const sourceData = useMemo(() => computeExpenseBySource(filtered), [filtered]);
  const expenseDonut = useMemo(() => computeExpenseByCategory(filtered), [filtered]);
  const incomeDonut = useMemo(() => computeIncomeByCategory(filtered), [filtered]);
  const daily = useMemo(
    () => withBurnProjection(computeDailyCumulative(filtered, month)),
    [filtered, month],
  );
  const dailyAverages = useMemo(
    () => computeDailyAverages(filtered, month),
    [filtered, month],
  );

  useEffect(() => {
    setCategoryFilter(null);
    setDateRange({ from: '', to: '' });
  }, [month]);

  const selectedDay =
    dateRange.from && dateRange.from === dateRange.to ? dateRange.from : null;

  const hasPrev = filteredPrev.length > 0;

  const monthKey = month.getFullYear() * 12 + month.getMonth();
  const prevMonth = [...allMonths]
    .reverse()
    .find((m) => m.getFullYear() * 12 + m.getMonth() < monthKey);
  const nextMonth = allMonths.find(
    (m) => m.getFullYear() * 12 + m.getMonth() > monthKey,
  );

  return (
    <section className="px-8 pt-6 pb-12 max-w-[1600px] mx-auto w-full">
      <div className="text-label uppercase text-on-surface-variant text-center">
        Extrato Detalhado
      </div>
      <div className="flex items-center justify-between mt-1">
        <button
          onClick={() => prevMonth && onMonthChange(prevMonth)}
          disabled={!prevMonth}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={24} strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-display">{formatMonthYear(month)}</h1>
          <MonthPicker value={month} onChange={onMonthChange} months={allMonths} />
        </div>
        <button
          onClick={() => nextMonth && onMonthChange(nextMonth)}
          disabled={!nextMonth}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight size={24} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(260px,1fr)_2fr] gap-5 mt-8">
        <div className="flex flex-col gap-4">
          <KPICardHighlighted
            label="Saldo do Mês"
            value={kpis.saldo}
            delta={hasPrev ? kpis.deltaSaldo : null}
            subtitle={`Taxa de economia: ${formatPercent(kpis.margin)}`}
          />
          <KPICard
            small
            label="Receitas Efetivas"
            value={kpis.receitas}
            tone="income"
          />
          <KPICard
            small
            label="Gastos Reais"
            value={kpis.gastos}
            tone="expense"
            breakdown={{
              label1: 'fixo',
              value1: recurringSplit.recurring,
              label2: 'variável',
              value2: recurringSplit.variable,
              color1: 'var(--color-secondary)',
              color2: 'var(--color-tertiary)',
            }}
          />
        </div>
        <ChartCard title="Curva de Despesas Acumulada Diária">
          <DailyCumulativeLine
            data={daily}
            avgDailyIncome={dailyAverages.avgIncome}
            avgDailyExpense={dailyAverages.avgExpense}
            selectedDate={selectedDay}
            onDayClick={(date) =>
              setDateRange(date ? { from: date, to: date } : { from: '', to: '' })
            }
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-5 mt-8">
        <ChartCard title="Despesas por Categoria">
          <CategoryDonut
            data={expenseDonut}
            centerLabel="Gasto Total"
            selectedCategory={categoryFilter?.label ?? null}
            onSelectCategory={(label, categories) =>
              setCategoryFilter(label ? { label, categories } : null)
            }
          />
        </ChartCard>
        <ChartCard title="Receitas por Categoria">
          <CategoryDonut
            data={incomeDonut}
            centerLabel="Receita Total"
            selectedCategory={categoryFilter?.label ?? null}
            onSelectCategory={(label, categories) =>
              setCategoryFilter(label ? { label, categories } : null)
            }
          />
        </ChartCard>
      </div>

      {hasPrev && (
        <div className="mt-8">
          <ChartCard title={`Variação vs. ${formatMonthYear(subMonths(month, 1))}`}>
            <WaterfallChart data={waterfall} />
          </ChartCard>
        </div>
      )}

      <div className="mt-8">
        <ChartCard title="Gastos por Fonte">
          <SourceBar data={sourceData} />
        </ChartCard>
      </div>

      <TransactionsLedger
        txs={filtered}
        txIndex={txIndex}
        categoryFilter={categoryFilter}
        onClearCategoryFilter={() => setCategoryFilter(null)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    </section>
  );
}
