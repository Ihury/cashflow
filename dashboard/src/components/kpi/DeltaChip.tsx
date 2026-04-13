import clsx from 'clsx';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatDelta } from '../../format/intl';

interface DeltaChipProps {
  delta: number;
  /** "good" significa que +Δ é bom (receitas), "bad" que +Δ é ruim (gastos). */
  tone: 'positive-good' | 'positive-bad';
  inverted?: boolean;
}

export function DeltaChip({ delta, tone, inverted }: DeltaChipProps) {
  const isPositiveValue = delta >= 0;
  const isGood =
    tone === 'positive-good' ? isPositiveValue : !isPositiveValue;

  const palette = inverted
    ? isGood
      ? 'bg-on-primary/15 text-on-primary'
      : 'bg-tertiary-container/40 text-on-primary'
    : isGood
      ? 'bg-primary-container text-primary-dim'
      : 'bg-tertiary-container text-tertiary';

  const Icon = isPositiveValue ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-label uppercase tabular',
        palette,
      )}
    >
      <Icon size={11} strokeWidth={2.5} />
      {formatDelta(delta)}
    </span>
  );
}
