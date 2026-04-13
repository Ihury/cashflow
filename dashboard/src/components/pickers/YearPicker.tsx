import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
  years: number[];
}

export function YearPicker({ value, onChange, years }: YearPickerProps) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm transition-colors"
      >
        {value}
        <ChevronDown size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-surface-lowest rounded-md p-1 min-w-[80px]">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => {
                onChange(y);
                setOpen(false);
              }}
              className={clsx(
                'block w-full text-left px-3 py-1.5 rounded-sm text-sm transition-colors',
                y === value
                  ? 'bg-primary-container text-primary-dim font-semibold'
                  : 'text-on-surface hover:bg-surface-low',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
