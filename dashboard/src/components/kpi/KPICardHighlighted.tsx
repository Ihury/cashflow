import clsx from 'clsx';
import { Check, ShieldCheck } from 'lucide-react';
import { DeltaChip } from './DeltaChip';
import { formatBRL } from '../../format/intl';

interface KPICardHighlightedProps {
  label: string;
  value: number;
  subtitle?: string;
  delta?: number | null;
  big?: boolean;
}

export function KPICardHighlighted({
  label,
  value,
  subtitle,
  delta,
  big,
}: KPICardHighlightedProps) {
  return (
    <div
      className={clsx(
        'rounded-md bg-primary text-on-primary relative overflow-hidden',
        big ? 'p-10' : 'p-7',
      )}
    >
      <div className="absolute right-6 top-6 opacity-20">
        <ShieldCheck size={big ? 56 : 36} strokeWidth={1.25} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-label uppercase opacity-80">{label}</span>
      </div>
      <div
        className={clsx(
          'tabular mt-4 font-semibold tracking-tight leading-none',
          big ? 'text-[3.25rem]' : 'text-[2.25rem]',
        )}
      >
        {formatBRL(value)}
      </div>
      {(subtitle || (delta !== null && delta !== undefined)) && (
        <div className="mt-3 flex items-center gap-2">
          {delta !== null && delta !== undefined ? (
            <span className="inline-flex items-center gap-1 text-label uppercase opacity-90">
              <Check size={11} strokeWidth={2.5} />
              <DeltaChip delta={delta} tone="positive-good" inverted />
            </span>
          ) : null}
          {subtitle && (
            <span className="text-label uppercase opacity-80">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
