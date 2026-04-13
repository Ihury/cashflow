import { useMemo, useState } from 'react';
import { useTransactions } from '../data/useTransactions';
import { applyMode, type Mode } from '../domain/modes';
import { availableYears, filterByYear } from '../domain/periods';
import {
  computeTopCounterparts,
  computeByDayOfWeek,
  computeFutureInstallments,
} from '../domain/aggregations';
import { ChartCard } from '../components/charts/ChartCard';
import { CounterpartRanking } from '../components/charts/CounterpartRanking';
import { DayOfWeekChart } from '../components/charts/DayOfWeekChart';
import { InstallmentTimeline } from '../components/charts/InstallmentTimeline';
import { YearPicker } from '../components/pickers/YearPicker';

interface AnaliseProps {
  mode: Mode;
}

export function Analise({ mode }: AnaliseProps) {
  const txs = useTransactions();
  const years = useMemo(() => availableYears(txs), [txs]);
  const [year, setYear] = useState(() => years[years.length - 1]);

  const yearTxs = useMemo(() => filterByYear(txs, year), [txs, year]);
  const filtered = useMemo(() => applyMode(yearTxs, mode), [yearTxs, mode]);
  // Para parcelas futuras, olhamos o dataset completo (não só o ano), pois
  // o comprometimento pode se estender além do ano selecionado.
  const allFiltered = useMemo(() => applyMode(txs, mode), [txs, mode]);

  const counterparts = useMemo(
    () => computeTopCounterparts(filtered, 15),
    [filtered],
  );
  const dayOfWeek = useMemo(() => computeByDayOfWeek(filtered), [filtered]);
  const installments = useMemo(
    () => computeFutureInstallments(allFiltered),
    [allFiltered],
  );

  return (
    <section className="px-8 pt-6 pb-12 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <h1 className="text-display">Análise</h1>
        <YearPicker value={year} onChange={setYear} years={years} />
      </div>
      <p className="text-on-surface-variant mt-2 text-sm">
        Padrões e comprometimento futuro
      </p>

      <div className="mt-8">
        <ChartCard title="Comprometimento Futuro em Parcelas">
          <InstallmentTimeline data={installments} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-5 mt-8">
        <ChartCard title="Maiores Destinos de Gasto">
          <CounterpartRanking data={counterparts} />
        </ChartCard>
        <ChartCard title="Padrão por Dia da Semana">
          <DayOfWeekChart data={dayOfWeek} />
        </ChartCard>
      </div>
    </section>
  );
}
