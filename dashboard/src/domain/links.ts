import type { Transaction } from '../types/transaction';

/**
 * Calcula o valor líquido de cada transação baseado nos settled_amounts dos links.
 *
 * - settles=true: o settled_amount reduz o abs(amount) da transação
 * - settles=false: informativo, não afeta o valor
 *
 * Só aplica netting quando a contraparte está no conjunto filtrado — se o link
 * aponta para fora do subconjunto (ex: outro mês), o valor permanece bruto.
 *
 * Transações totalmente abatidas (net_amount === 0) são PRESERVADAS com
 * _fullySettled=true para que a UI possa exibi-las com visual diferenciado.
 */
export function applyLinkNetting(txs: Transaction[]): Transaction[] {
  const idSet = new Set(txs.map((t) => t.id));

  return txs.map((t) => {
    const settledTotal = (t.links ?? [])
      .filter((l) => l.settles && idSet.has(l.linked_to))
      .reduce((sum, l) => sum + (l.settled_amount ?? 0), 0);

    if (settledTotal === 0) return t;

    const absAmount = Math.abs(t.amount);
    const unsettled = Math.max(0, absAmount - settledTotal);
    const netAmount = Math.sign(t.amount) * unsettled;

    return {
      ...t,
      _originalAmount: t.amount,
      _netAmount: netAmount,
      _settledTotal: settledTotal,
      _fullySettled: netAmount === 0,
      amount: netAmount,
    };
  });
}
