import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
  subMonths,
} from 'date-fns';
import type { Transaction } from '../types/transaction';

export type Period =
  | { kind: 'year'; year: number }
  | { kind: 'month'; date: Date };

/** Resolve um Period em intervalo concreto [start, end] inclusive. */
export function resolvePeriod(p: Period): { start: Date; end: Date } {
  if (p.kind === 'year') {
    const ref = new Date(p.year, 0, 1);
    return { start: startOfYear(ref), end: endOfYear(ref) };
  }
  return { start: startOfMonth(p.date), end: endOfMonth(p.date) };
}

/** Período imediatamente anterior, para cálculo de delta. */
export function previousPeriod(p: Period): Period {
  if (p.kind === 'year') return { kind: 'year', year: p.year - 1 };
  return { kind: 'month', date: subMonths(p.date, 1) };
}

export function filterByPeriod(
  txs: Transaction[],
  p: Period,
): Transaction[] {
  const { start, end } = resolvePeriod(p);
  return txs.filter((t) => {
    const d = parseISO(t.date + 'T00:00:00');
    return isWithinInterval(d, { start, end });
  });
}

export function filterByMonth(txs: Transaction[], monthStart: Date): Transaction[] {
  return filterByPeriod(txs, { kind: 'month', date: monthStart });
}

export function filterByYear(txs: Transaction[], year: number): Transaction[] {
  return filterByPeriod(txs, { kind: 'year', year });
}

/** Anos distintos presentes nos dados, ordenados ascendente. */
export function availableYears(txs: Transaction[]): number[] {
  const set = new Set<number>();
  for (const t of txs) set.add(+t.date.slice(0, 4));
  return [...set].sort((a, b) => a - b);
}

/** Meses (como Date no dia 1) que têm dados em um dado ano, ordenados. */
export function availableMonths(txs: Transaction[], year: number): Date[] {
  const set = new Set<string>();
  for (const t of txs) {
    if (+t.date.slice(0, 4) === year) set.add(t.date.slice(0, 7));
  }
  return [...set]
    .sort()
    .map((s) => parseISO(s + '-01T00:00:00'));
}
