import { Landmark, CreditCard, Utensils } from 'lucide-react';
import { SOURCE_LABELS } from '../../domain/labels';
import type { TransactionSource } from '../../types/transaction';

interface SourceChipProps {
  source: TransactionSource;
}

const KIND_ICON = {
  bank: Landmark,
  card: CreditCard,
  benefit: Utensils,
} as const;

export function SourceChip({ source }: SourceChipProps) {
  const meta = SOURCE_LABELS[source];
  if (!meta) return <span className="text-on-surface-variant">{source}</span>;
  const Icon = KIND_ICON[meta.kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon size={11} strokeWidth={2} />
      {meta.label}
    </span>
  );
}
