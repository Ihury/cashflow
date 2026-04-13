import {
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { Transaction, TransactionSource } from '../types/transaction';
import { RECURRING_CATEGORIES, SOURCE_LABELS } from './labels';

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface KPIs {
  receitas: number;
  gastos: number; // sempre positivo
  saldo: number;
  margin: number; // saldo / receitas, 0..1
  count: number;
}

export interface DeltaKPIs extends KPIs {
  deltaReceitas: number | null;
  deltaGastos: number | null;
  deltaSaldo: number | null;
}

export function computeKPIs(txs: Transaction[]): KPIs {
  let receitas = 0;
  let gastos = 0;
  for (const t of txs) {
    if (t.amount > 0) receitas += t.amount;
    else gastos += -t.amount;
  }
  const saldo = receitas - gastos;
  const margin = receitas > 0 ? saldo / receitas : 0;
  return { receitas, gastos, saldo, margin, count: txs.length };
}

export function computeDeltaKPIs(
  current: Transaction[],
  previous: Transaction[],
): DeltaKPIs {
  const cur = computeKPIs(current);
  const prev = computeKPIs(previous);
  const ratio = (c: number, p: number): number | null =>
    p === 0 ? null : (c - p) / Math.abs(p);
  return {
    ...cur,
    deltaReceitas: ratio(cur.receitas, prev.receitas),
    deltaGastos: ratio(cur.gastos, prev.gastos),
    deltaSaldo: ratio(cur.saldo, prev.saldo),
  };
}

export interface MonthlyBar {
  monthKey: string; // YYYY-MM
  monthLabel: string; // Jan, Fev, Mar...
  receitas: number;
  gastos: number;
}

const PT_MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function computeMonthlyBars(txs: Transaction[]): MonthlyBar[] {
  const buckets = new Map<string, { receitas: number; gastos: number }>();
  for (const t of txs) {
    const key = t.date.slice(0, 7);
    const b = buckets.get(key) ?? { receitas: 0, gastos: 0 };
    if (t.amount > 0) b.receitas += t.amount;
    else b.gastos += -t.amount;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const m = +key.slice(5, 7) - 1;
      return {
        monthKey: key,
        monthLabel: PT_MONTH_SHORT[m] ?? key,
        receitas: v.receitas,
        gastos: v.gastos,
      };
    });
}

export interface CategorySlice {
  category: string;
  total: number;
  share: number; // 0..1
}

export function computeExpenseByCategory(txs: Transaction[]): CategorySlice[] {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const cat = t.category ?? 'Outros';
    const v = -t.amount;
    buckets.set(cat, (buckets.get(cat) ?? 0) + v);
    total += v;
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, val]) => ({
      category,
      total: val,
      share: total > 0 ? val / total : 0,
    }));
}

export function computeIncomeByCategory(txs: Transaction[]): CategorySlice[] {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.amount <= 0) continue;
    const cat = t.category ?? 'Outros';
    buckets.set(cat, (buckets.get(cat) ?? 0) + t.amount);
    total += t.amount;
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, val]) => ({
      category,
      total: val,
      share: total > 0 ? val / total : 0,
    }));
}

export interface CategoryTrendPoint {
  monthKey: string;
  monthLabel: string;
  [category: string]: number | string;
}

export function computeCategoryTrend(
  txs: Transaction[],
  topN: number = 6,
): { data: CategoryTrendPoint[]; categories: string[] } {
  const totalsByCat = new Map<string, number>();
  const byMonthCat = new Map<string, Map<string, number>>();

  for (const t of txs) {
    if (t.amount >= 0) continue;
    const cat = t.category ?? 'Outros';
    const v = -t.amount;
    totalsByCat.set(cat, (totalsByCat.get(cat) ?? 0) + v);
    const monthKey = t.date.slice(0, 7);
    if (!byMonthCat.has(monthKey)) byMonthCat.set(monthKey, new Map());
    const bucket = byMonthCat.get(monthKey)!;
    bucket.set(cat, (bucket.get(cat) ?? 0) + v);
  }

  const topCats = [...totalsByCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([c]) => c);
  const topSet = new Set(topCats);
  const hasOther = [...totalsByCat.keys()].some((c) => !topSet.has(c));
  // Usa "Demais" em vez de "Outros" para não colidir quando "Outros" já é uma das topCats.
  const OTHER_KEY = 'Demais';
  const categories = hasOther ? [...topCats, OTHER_KEY] : topCats;

  const sortedMonths = [...byMonthCat.keys()].sort();
  const data: CategoryTrendPoint[] = sortedMonths.map((monthKey) => {
    const m = +monthKey.slice(5, 7) - 1;
    const point: CategoryTrendPoint = {
      monthKey,
      monthLabel: PT_MONTH_SHORT[m] ?? monthKey,
    };
    for (const cat of categories) point[cat] = 0;
    const bucket = byMonthCat.get(monthKey)!;
    for (const [cat, v] of bucket.entries()) {
      if (topSet.has(cat)) point[cat] = ((point[cat] as number) ?? 0) + v;
      else if (hasOther) point[OTHER_KEY] = ((point[OTHER_KEY] as number) ?? 0) + v;
    }
    return point;
  });

  return { data, categories };
}

export interface SourceSlice {
  source: TransactionSource;
  label: string;
  total: number;
  share: number;
  color: string;
}

export function computeExpenseBySource(txs: Transaction[]): SourceSlice[] {
  const buckets = new Map<TransactionSource, number>();
  let total = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const v = -t.amount;
    buckets.set(t.source, (buckets.get(t.source) ?? 0) + v);
    total += v;
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, val]) => {
      const meta = SOURCE_LABELS[source];
      return {
        source,
        label: meta.label,
        total: val,
        share: total > 0 ? val / total : 0,
        color: meta.color,
      };
    });
}

export interface WaterfallItem {
  category: string;
  current: number;
  previous: number;
  delta: number;
  isTotal?: boolean;
}

export function computeMonthWaterfall(
  currentTxs: Transaction[],
  previousTxs: Transaction[],
  topN: number = 8,
): WaterfallItem[] {
  const buildByCat = (txs: Transaction[]) => {
    const m = new Map<string, number>();
    for (const t of txs) {
      if (t.amount >= 0) continue;
      const cat = t.category ?? 'Outros';
      m.set(cat, (m.get(cat) ?? 0) + -t.amount);
    }
    return m;
  };
  const curr = buildByCat(currentTxs);
  const prev = buildByCat(previousTxs);
  const allCats = new Set([...curr.keys(), ...prev.keys()]);
  const items: WaterfallItem[] = [];
  for (const cat of allCats) {
    const c = curr.get(cat) ?? 0;
    const p = prev.get(cat) ?? 0;
    items.push({ category: cat, current: c, previous: p, delta: c - p });
  }
  items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = items.slice(0, topN);
  const totalDelta = items.reduce((s, it) => s + it.delta, 0);
  top.push({
    category: 'Total',
    current: 0,
    previous: 0,
    delta: totalDelta,
    isTotal: true,
  });
  return top;
}

export interface CounterpartSlice {
  counterpart: string;
  total: number;
  count: number;
  share: number;
}

export function computeTopCounterparts(
  txs: Transaction[],
  topN: number = 15,
): CounterpartSlice[] {
  const buckets = new Map<string, { total: number; count: number }>();
  let total = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const raw = (t.counterpart ?? t.description_clean ?? t.description ?? '').trim();
    if (!raw) continue;
    const cp = titleCase(raw);
    const v = -t.amount;
    const b = buckets.get(cp) ?? { total: 0, count: 0 };
    b.total += v;
    b.count += 1;
    buckets.set(cp, b);
    total += v;
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, topN)
    .map(([counterpart, v]) => ({
      counterpart,
      total: v.total,
      count: v.count,
      share: total > 0 ? v.total / total : 0,
    }));
}

export interface DayOfWeekSlice {
  dayIndex: number;
  dayLabel: string;
  totalExpense: number;
  avgExpense: number;
  count: number;
}

const PT_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function computeByDayOfWeek(txs: Transaction[]): DayOfWeekSlice[] {
  const totals = new Array(7).fill(0) as number[];
  const counts = new Array(7).fill(0) as number[];
  const expenseDates: string[] = [];
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const d = parseLocalDate(t.date);
    const idx = d.getDay();
    totals[idx] += -t.amount;
    counts[idx] += 1;
    expenseDates.push(t.date);
  }
  // Calcular número de semanas no período para médias corretas
  let totalWeeks = 1;
  if (expenseDates.length > 0) {
    expenseDates.sort();
    const first = parseLocalDate(expenseDates[0]);
    const last = parseLocalDate(expenseDates[expenseDates.length - 1]);
    totalWeeks = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)),
    );
  }
  return PT_DAYS_SHORT.map((label, i) => ({
    dayIndex: i,
    dayLabel: label,
    totalExpense: totals[i],
    avgExpense: totalWeeks > 0 ? totals[i] / totalWeeks : 0,
    count: counts[i],
  }));
}

export interface FutureInstallmentItem {
  description: string;
  amount: number;
  currentOfTotal: string;
}

export interface FutureInstallment {
  monthKey: string;
  monthLabel: string;
  totalCommitted: number;
  items: FutureInstallmentItem[];
}

export function computeFutureInstallments(txs: Transaction[]): {
  totalFutureCommitted: number;
  monthsAhead: FutureInstallment[];
} {
  const byMonth = new Map<string, FutureInstallment>();
  let totalFutureCommitted = 0;
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM');

  for (const t of txs) {
    if (!t.installment) continue;
    if (t.amount >= 0) continue;
    const { current, total } = t.installment;
    if (total <= current) continue;
    const base = parseLocalDate(t.date);
    const perInstallment = -t.amount;
    const remaining = total - current;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const monthKey = format(d, 'yyyy-MM');
      if (monthKey < todayKey) continue;
      const m = d.getMonth();
      const monthLabel = `${PT_MONTH_SHORT[m]}/${String(d.getFullYear()).slice(2)}`;
      const bucket =
        byMonth.get(monthKey) ??
        { monthKey, monthLabel, totalCommitted: 0, items: [] };
      bucket.totalCommitted += perInstallment;
      bucket.items.push({
        description: t.description_clean || t.description,
        amount: perInstallment,
        currentOfTotal: `${current + i}/${total}`,
      });
      byMonth.set(monthKey, bucket);
      totalFutureCommitted += perInstallment;
    }
  }

  const monthsAhead = [...byMonth.values()]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(0, 12);
  return { totalFutureCommitted, monthsAhead };
}

export interface RecurringVsVariable {
  recurring: number;
  variable: number;
  recurringShare: number;
}

export function computeRecurringVsVariable(txs: Transaction[]): RecurringVsVariable {
  let recurring = 0;
  let variable = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const cat = t.category ?? 'Outros';
    const v = -t.amount;
    if (RECURRING_CATEGORIES.has(cat)) recurring += v;
    else variable += v;
  }
  const total = recurring + variable;
  return { recurring, variable, recurringShare: total > 0 ? recurring / total : 0 };
}

export interface DailyAverages {
  avgIncome: number;
  avgExpense: number;
  days: number;
}

export function computeDailyAverages(
  txs: Transaction[],
  monthStart: Date,
): DailyAverages {
  const days = eachDayOfInterval({
    start: startOfMonth(monthStart),
    end: endOfMonth(monthStart),
  }).length;
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.amount > 0) income += t.amount;
    else expense += -t.amount;
  }
  return {
    avgIncome: days > 0 ? income / days : 0,
    avgExpense: days > 0 ? expense / days : 0,
    days,
  };
}

export interface DailyPoint {
  day: string; // "1", "2", ...
  date: string; // "2026-04-01"
  daily: number;
  accumulated: number;
  /** Projeção linear do acumulado (só preenchido do "hoje" em diante). */
  projected?: number;
}

export function computeDailyCumulative(
  txs: Transaction[],
  monthStart: Date,
): DailyPoint[] {
  const start = startOfMonth(monthStart);
  const end = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start, end });
  const byDay = new Map<string, number>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + -t.amount);
  }
  let acc = 0;
  return days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const daily = byDay.get(key) ?? 0;
    acc += daily;
    return { day: format(d, 'd'), date: key, daily, accumulated: acc };
  });
}

/**
 * Enriquece os pontos diários com uma projeção linear do acumulado, a partir
 * do último dia com dados reais (até hoje). A projeção começa no ponto atual
 * e segue `accumulated + rate * i` até o fim do mês.
 */
export function withBurnProjection(points: DailyPoint[]): DailyPoint[] {
  if (points.length === 0) return points;
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  // Último dia real: o que ainda está <= hoje (ou o último do mês se já passou).
  let lastRealIdx = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].date <= todayKey) lastRealIdx = i;
  }
  if (lastRealIdx < 0) return points;
  const lastReal = points[lastRealIdx];
  if (lastReal.accumulated <= 0) return points;
  const daysElapsed = lastRealIdx + 1;
  const dailyRate = lastReal.accumulated / daysElapsed;
  // Sem projeção se já é o último dia do mês.
  if (lastRealIdx >= points.length - 1) return points;
  return points.map((p, i) => {
    if (i < lastRealIdx) return p;
    const offset = i - lastRealIdx;
    return { ...p, projected: lastReal.accumulated + dailyRate * offset };
  });
}

/** Ordena por data desc; usa created_at como tiebreaker. */
export function sortByDateDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/** Helper que combina parseISO + meia-noite local para evitar UTC slip. */
export function parseLocalDate(iso: string): Date {
  return parseISO(iso + 'T00:00:00');
}
