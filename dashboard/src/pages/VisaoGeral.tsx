import { useEffect, useMemo, useState } from 'react';
import { useTransactions } from '../data/useTransactions';
import { applyMode, type Mode } from '../domain/modes';
import { availableYears, filterByYear } from '../domain/periods';
import {
  computeDeltaKPIs,
  computeExpenseByCategory,
  computeMonthlyBars,
  computeCategoryTrend,
  computeExpenseBySource,
} from '../domain/aggregations';
import { KPICard } from '../components/kpi/KPICard';
import { KPICardHighlighted } from '../components/kpi/KPICardHighlighted';
import { ChartCard } from '../components/charts/ChartCard';
import { MonthlyEvolutionBars } from '../components/charts/MonthlyEvolutionBars';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { CategoryTrendArea } from '../components/charts/CategoryTrendArea';
import { SourceBar } from '../components/charts/SourceBar';
import { TransactionsLedger } from '../components/table/TransactionsLedger';
import { YearPicker } from '../components/pickers/YearPicker';
import { formatPercent } from '../format/intl';

interface VisaoGeralProps {
  mode: Mode;
  onNavigateToMonth: (date: Date) => void;
}

export function VisaoGeral({ mode, onNavigateToMonth }: VisaoGeralProps) {
  const txs = useTransactions();
  const years = useMemo(() => availableYears(txs), [txs]);
  const [year, setYear] = useState(() => years[years.length - 1]);
  const [categoryFilter, setCategoryFilter] = useState<{
    label: string;
    categories: string[];
  } | null>(null);
  const [chartView, setChartView] = useState<'composition' | 'trend'>('composition');

  useEffect(() => {
    setCategoryFilter(null);
  }, [year]);

  const yearTxs = useMemo(() => filterByYear(txs, year), [txs, year]);
  const prevYearTxs = useMemo(() => filterByYear(txs, year - 1), [txs, year]);

  const filtered = useMemo(() => applyMode(yearTxs, mode), [yearTxs, mode]);
  const filteredPrev = useMemo(() => applyMode(prevYearTxs, mode), [prevYearTxs, mode]);

  const kpis = useMemo(
    () => computeDeltaKPIs(filtered, filteredPrev),
    [filtered, filteredPrev],
  );

  const monthly = useMemo(() => computeMonthlyBars(filtered), [filtered]);
  const donut = useMemo(() => computeExpenseByCategory(filtered), [filtered]);
  const trend = useMemo(() => computeCategoryTrend(filtered, 6), [filtered]);
  const sourceData = useMemo(() => computeExpenseBySource(filtered), [filtered]);
  const txIndex = useMemo(() => new Map(filtered.map((t) => [t.id, t])), [filtered]);

  const hasPrev = filteredPrev.length > 0;

  return (
    <section className="px-8 pt-6 pb-12 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <h1 className="text-display">Status Patrimonial</h1>
        <YearPicker value={year} onChange={setYear} years={years} />
      </div>
      <p className="text-on-surface-variant mt-2 text-sm">
        Consolidado do ano: {year}
      </p>

      <div className="grid grid-cols-3 gap-5 mt-8">
        <KPICard
          label="Receitas Efetivas"
          value={kpis.receitas}
          delta={hasPrev ? kpis.deltaReceitas : null}
          tone="income"
        />
        <KPICard
          label="Gastos Reais"
          value={kpis.gastos}
          delta={hasPrev ? kpis.deltaGastos : null}
          tone="expense"
        />
        <KPICardHighlighted
          label="Saldo Acumulado"
          value={kpis.saldo}
          subtitle={`Taxa de economia: ${formatPercent(kpis.margin)}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mt-8">
        <ChartCard title="Evolução Mensal">
          <MonthlyEvolutionBars
            data={monthly}
            onBarClick={(monthKey) => {
              const [y, m] = monthKey.split('-').map(Number);
              onNavigateToMonth(new Date(y, m - 1, 1));
            }}
          />
        </ChartCard>
        <ChartCard
          title={chartView === 'composition' ? 'Composição' : 'Tendência'}
          actions={
            <ViewToggle value={chartView} onChange={setChartView} />
          }
        >
          {chartView === 'composition' ? (
            <CategoryDonut
              data={donut}
              centerLabel="Gasto Total"
              centerValue="100%"
              selectedCategory={categoryFilter?.label ?? null}
              onSelectCategory={(label, categories) =>
                setCategoryFilter(label ? { label, categories } : null)
              }
            />
          ) : (
            <CategoryTrendArea data={trend.data} categories={trend.categories} />
          )}
        </ChartCard>
      </div>

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
      />
    </section>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'composition' | 'trend';
  onChange: (v: 'composition' | 'trend') => void;
}) {
  const opts: { id: 'composition' | 'trend'; label: string }[] = [
    { id: 'composition', label: 'Composição' },
    { id: 'trend', label: 'Tendência' },
  ];
  return (
    <div className="inline-flex items-center rounded-full bg-surface-low p-0.5">
      {opts.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={
              'text-label uppercase px-3 py-1 rounded-full transition-colors ' +
              (active
                ? 'bg-surface-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
