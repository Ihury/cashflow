import type { Transaction } from '../types/transaction';
import { applyLinkNetting } from './links';

export type Mode = 'bruto' | 'liquido';

/**
 * Pagamentos de fatura (invoice_payment) são sempre removidos em ambos os
 * modos — as despesas do cartão já estão lançadas individualmente, então o
 * pagamento da fatura é sempre uma duplicação.
 *
 * BRUTO: fluxo de caixa — toda movimentação conta (exceto faturas duplicadas).
 * LÍQUIDO: economia real — aplica netting data-driven via settles/settled_amount
 * dos links. Transferências próprias são zeradas pelo netting quando pareadas.
 */
export function applyMode(txs: Transaction[], mode: Mode): Transaction[] {
  const base = txs.filter((t) => t.type !== 'invoice_payment');
  if (mode === 'bruto') return base;
  return applyLinkNetting(base);
}
