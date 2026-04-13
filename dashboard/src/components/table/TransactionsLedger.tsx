import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import { TransactionsTable } from './TransactionsTable';
import { SearchFilter } from './SearchFilter';

export type FlowValue = 'all' | 'income' | 'expense';

export interface CategoryFilter {
  label: string;
  categories: string[];
}

export interface DateRange {
  from: string;
  to: string;
}

interface TransactionsLedgerProps {
  txs: Transaction[];
  txIndex: Map<string, Transaction>;
  title?: string;
  categoryFilter?: CategoryFilter | null;
  onClearCategoryFilter?: () => void;
  /** Controlled date range. When omitted, ledger manages its own state. */
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export function TransactionsLedger({
  txs,
  txIndex,
  title = 'Ledger de Transações',
  categoryFilter = null,
  onClearCategoryFilter,
  dateRange,
  onDateRangeChange,
}: TransactionsLedgerProps) {
  const [search, setSearch] = useState('');
  const [flowFilter, setFlowFilter] = useState<FlowValue>('all');
  const [internalFrom, setInternalFrom] = useState('');
  const [internalTo, setInternalTo] = useState('');

  const controlled = dateRange !== undefined;
  const dateFrom = controlled ? dateRange.from : internalFrom;
  const dateTo = controlled ? dateRange.to : internalTo;
  const setRange = (from: string, to: string) => {
    if (controlled) {
      onDateRangeChange?.({ from, to });
    } else {
      setInternalFrom(from);
      setInternalTo(to);
    }
  };

  const txsRangeBounds = useMemo(() => {
    if (txs.length === 0) return { min: '', max: '' };
    let min = txs[0].date;
    let max = txs[0].date;
    for (const t of txs) {
      if (t.date < min) min = t.date;
      if (t.date > max) max = t.date;
    }
    return { min, max };
  }, [txs]);

  useEffect(() => {
    if (controlled) return;
    setInternalFrom('');
    setInternalTo('');
  }, [txsRangeBounds.min, txsRangeBounds.max, controlled]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return txs;
    return txs.filter((t) => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [txs, dateFrom, dateTo]);

  const categoryFiltered = useMemo(() => {
    if (!categoryFilter) return dateFiltered;
    const set = new Set(categoryFilter.categories);
    return dateFiltered.filter((t) => set.has(t.category ?? 'Outros'));
  }, [dateFiltered, categoryFilter]);

  const flowFiltered = useMemo(() => {
    if (flowFilter === 'all') return categoryFiltered;
    if (flowFilter === 'income') return categoryFiltered.filter((t) => t.amount > 0);
    return categoryFiltered.filter((t) => t.amount < 0);
  }, [categoryFiltered, flowFilter]);

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return flowFiltered;
    const needle = search.trim().toLowerCase();
    return flowFiltered.filter(
      (t) =>
        t.description_clean.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle) ||
        (t.category ?? '').toLowerCase().includes(needle),
    );
  }, [flowFiltered, search]);

  return (
    <div className="mt-8 bg-surface-lowest rounded-md p-7">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-headline">{title}</h2>
          {categoryFilter && onClearCategoryFilter && (
            <button
              type="button"
              onClick={onClearCategoryFilter}
              className="text-xs px-2 py-1 rounded-full bg-surface-low text-on-surface-variant hover:bg-surface-container"
            >
              {categoryFilter.label} ×
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            min={txsRangeBounds.min}
            max={txsRangeBounds.max}
            onChange={setRange}
          />
          <FlowToggle value={flowFilter} onChange={setFlowFilter} />
          <SearchFilter value={search} onChange={setSearch} />
        </div>
      </div>
      <TransactionsTable txs={searchFiltered} txIndex={txIndex} showPagination pageSize={50} />
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
  min,
  max,
  onChange,
}: {
  from: string;
  to: string;
  min: string;
  max: string;
  onChange: (from: string, to: string) => void;
}) {
  const active = !!(from || to);
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 text-xs transition-colors ${
        active ? 'text-on-surface' : 'text-on-surface-variant'
      }`}
    >
      <CalendarRange size={13} strokeWidth={1.75} />
      <input
        type="date"
        value={from}
        min={min || undefined}
        max={to || max || undefined}
        onChange={(e) => onChange(e.target.value, to)}
        className="bg-transparent outline-none tabular w-[100px]"
      />
      <span className="opacity-60">—</span>
      <input
        type="date"
        value={to}
        min={from || min || undefined}
        max={max || undefined}
        onChange={(e) => onChange(from, e.target.value)}
        className="bg-transparent outline-none tabular w-[100px]"
      />
      {active && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="ml-0.5 text-on-surface-variant hover:text-on-surface"
          aria-label="Limpar período"
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function FlowToggle({
  value,
  onChange,
}: {
  value: FlowValue;
  onChange: (v: FlowValue) => void;
}) {
  const options: { value: FlowValue; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'income', label: 'Receitas' },
    { value: 'expense', label: 'Despesas' },
  ];
  return (
    <div className="inline-flex rounded-full bg-surface-low p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-full transition-colors ${
            value === opt.value
              ? 'bg-surface-lowest text-on-surface font-medium shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
