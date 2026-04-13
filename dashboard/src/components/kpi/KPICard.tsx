import clsx from 'clsx';
import { DeltaChip } from './DeltaChip';
import { formatBRL, formatBRLCompact } from '../../format/intl';

interface KPICardBreakdown {
  label1: string;
  value1: number;
  label2: string;
  value2: number;
  /** Cor do segmento 1 (CSS var ou hex). */
  color1?: string;
  /** Cor do segmento 2 (CSS var ou hex). */
  color2?: string;
}

interface KPICardProps {
  label: string;
  value: number;
  delta?: number | null;
  /** "income" → +delta é bom; "expense" → +delta é ruim. */
  tone: 'income' | 'expense' | 'neutral';
  small?: boolean;
  hint?: string;
  breakdown?: KPICardBreakdown;
}

export function KPICard({ label, value, delta, tone, small, hint, breakdown }: KPICardProps) {
  return (
    <div
      className={clsx(
        'bg-surface-lowest rounded-md',
        small ? 'p-5' : 'p-7',
      )}
    >
      <div className="text-label uppercase text-on-surface-variant">{label}</div>
      <div
        className={clsx(
          'tabular mt-3 font-semibold tracking-tight',
          small ? 'text-2xl' : 'text-[2.25rem] leading-none',
          tone === 'income' && 'text-primary',
          tone === 'expense' && 'text-tertiary',
        )}
      >
        {formatBRL(value)}
      </div>
      {breakdown && (() => {
        const total = breakdown.value1 + breakdown.value2;
        const pct1 = total > 0 ? (breakdown.value1 / total) * 100 : 0;
        const pct2 = total > 0 ? 100 - pct1 : 0;
        const c1 = breakdown.color1 ?? 'var(--color-secondary)';
        const c2 = breakdown.color2 ?? 'var(--color-tertiary)';
        return (
          <div className="mt-4">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-low">
              <div style={{ width: `${pct1}%`, background: c1 }} />
              <div style={{ width: `${pct2}%`, background: c2 }} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-label uppercase text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: c1 }} />
                {formatBRLCompact(breakdown.value1)} {breakdown.label1}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: c2 }} />
                {formatBRLCompact(breakdown.value2)} {breakdown.label2}
              </span>
            </div>
          </div>
        );
      })()}
      {(delta !== null && delta !== undefined) || hint ? (
        <div className="mt-3 flex items-center gap-2">
          {delta !== null && delta !== undefined && (
            <DeltaChip
              delta={delta}
              tone={tone === 'expense' ? 'positive-bad' : 'positive-good'}
            />
          )}
          {hint && (
            <span className="text-label uppercase text-on-surface-variant">
              {hint}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
