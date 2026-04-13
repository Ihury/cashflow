import clsx from 'clsx';
import { LayoutDashboard, CalendarDays, TrendingUp } from 'lucide-react';
import type { PageId } from '../../App';
import type { Mode } from '../../domain/modes';

interface TopBarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  lastUpdated: string;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { id: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'visao-mensal', label: 'Visão Mensal', icon: CalendarDays },
  { id: 'analise', label: 'Análise', icon: TrendingUp },
];

const MODES: { id: Mode; label: string }[] = [
  { id: 'bruto', label: 'Fluxo de Caixa (Bruto)' },
  { id: 'liquido', label: 'Economia Real (Líquido)' },
];

export function TopBar({ page, onNavigate, mode, onModeChange, lastUpdated }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-surface-lowest border-b border-outline-variant">
      <div className="flex items-center gap-8 py-3 px-6">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-headline tracking-tight">Ledger</span>
          <span className="text-label uppercase text-on-surface-variant">
            Nordic Finance
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors',
                  active
                    ? 'bg-surface-low text-primary-dim font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                <Icon size={15} strokeWidth={1.75} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-6 ml-auto">
          <div className="flex items-center gap-5">
            {MODES.map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onModeChange(tab.id)}
                  className={clsx(
                    'relative py-1 text-label uppercase transition-colors',
                    active
                      ? 'text-on-surface'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-on-surface" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-on-surface-variant leading-tight text-right shrink-0">
            <div className="text-label uppercase">Última atualização</div>
            <div className="text-on-surface tabular">
              {formatLastUpdated(lastUpdated)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function formatLastUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}
