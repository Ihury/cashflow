import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MonthPickerProps {
  value: Date;
  onChange: (month: Date) => void;
  months: Date[];
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

export function MonthPicker({ value, onChange, months }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Group by year
  const byYear = new Map<number, Date[]>();
  for (const m of months) {
    const y = m.getFullYear();
    const arr = byYear.get(y) ?? [];
    arr.push(m);
    byYear.set(y, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  const valueKey = `${value.getFullYear()}-${value.getMonth()}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-surface-container hover:bg-surface-high text-on-surface-variant transition-colors"
      >
        <ChevronDown size={16} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-10 bg-surface-lowest rounded-md p-3 min-w-[260px]">
          {years.map((y) => (
            <div key={y} className="mb-3 last:mb-0">
              <div className="text-label uppercase text-on-surface-variant px-2 mb-1">
                {y}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {byYear.get(y)!.map((m) => {
                  const active = `${y}-${m.getMonth()}` === valueKey;
                  return (
                    <button
                      key={m.toISOString()}
                      onClick={() => {
                        onChange(m);
                        setOpen(false);
                      }}
                      className={clsx(
                        'px-2 py-1.5 rounded-sm text-sm transition-colors',
                        active
                          ? 'bg-primary-container text-primary-dim font-semibold'
                          : 'text-on-surface hover:bg-surface-low',
                      )}
                    >
                      {PT_MONTH_SHORT[m.getMonth()]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
