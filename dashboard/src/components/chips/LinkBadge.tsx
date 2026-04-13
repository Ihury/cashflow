import clsx from 'clsx';
import {
  ArrowLeftRight,
  RotateCcw,
  Receipt,
  Forward,
  Repeat,
  Undo2,
  Split,
  Banknote,
} from 'lucide-react';
import type { LinkType } from '../../types/transaction';

interface LinkBadgeProps {
  type: LinkType;
  settles: boolean;
}

const LINK_META: Record<
  string,
  { abbr: string; label: string; icon: typeof ArrowLeftRight }
> = {
  self_transfer: { abbr: 'ST', label: 'Transf. própria', icon: ArrowLeftRight },
  test_refund: { abbr: 'TR', label: 'Teste checkout', icon: RotateCcw },
  estorno: { abbr: 'ES', label: 'Estorno', icon: Undo2 },
  reimbursement: { abbr: 'RE', label: 'Reembolso', icon: Receipt },
  pass_through: { abbr: 'PT', label: 'Repasse', icon: Forward },
  split_bill: { abbr: 'DV', label: 'Divisão', icon: Split },
  loan_repayment: { abbr: 'LR', label: 'Devol. empréstimo', icon: Banknote },
  loan: { abbr: 'EM', label: 'Empréstimo', icon: Banknote },
  installment_group: { abbr: 'PC', label: 'Parcela', icon: Repeat },
  debt_chain: { abbr: 'DC', label: 'Cadeia dívida', icon: Forward },
  overpayment_return: { abbr: 'OV', label: 'Devol. excedente', icon: Undo2 },
  invoice_payment: { abbr: 'FT', label: 'Pag. fatura', icon: Receipt },
};

export function LinkBadge({ type, settles }: LinkBadgeProps) {
  const meta = LINK_META[type] ?? {
    abbr: '??',
    label: type,
    icon: ArrowLeftRight,
  };
  const Icon = meta.icon;

  return (
    <span
      title={meta.label + (settles ? ' (compensa)' : '')}
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap',
        settles
          ? 'bg-primary-container/60 text-primary-dim'
          : 'bg-surface-container text-on-surface-variant',
      )}
    >
      <Icon size={9} strokeWidth={2} />
      {meta.abbr}
    </span>
  );
}

export function getLinkLabel(type: LinkType): string {
  return LINK_META[type]?.label ?? type;
}
