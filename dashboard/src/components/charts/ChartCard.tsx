import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, hint, actions, children }: ChartCardProps) {
  return (
    <div className="bg-surface-lowest rounded-md p-7">
      <div className="flex items-baseline justify-between mb-6 gap-4">
        <h3 className="text-headline">{title}</h3>
        <div className="flex items-center gap-3">
          {hint && (
            <span className="text-label uppercase text-on-surface-variant">
              {hint}
            </span>
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
