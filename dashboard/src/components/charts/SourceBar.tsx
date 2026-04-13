import type { SourceSlice } from '../../domain/aggregations';
import { formatBRL, formatPercent } from '../../format/intl';

interface SourceBarProps {
  data: SourceSlice[];
}

export function SourceBar({ data }: SourceBarProps) {
  const max = data.reduce((m, d) => Math.max(m, d.total), 0);
  if (!data.length) {
    return (
      <div className="text-on-surface-variant text-sm py-6 text-center">
        Sem dados para o período.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {data.map((s) => {
        const pct = max > 0 ? (s.total / max) * 100 : 0;
        return (
          <li key={s.source} className="grid grid-cols-[160px_1fr_auto] items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-on-surface truncate">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <div className="relative h-5 rounded bg-surface-low overflow-hidden">
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: s.color }}
              />
            </div>
            <span className="tabular text-sm font-semibold text-on-surface text-right min-w-[160px]">
              {formatBRL(s.total)}
              <span className="ml-2 text-on-surface-variant font-normal">
                {formatPercent(s.share)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
