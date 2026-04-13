import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronUp, ChevronDown, EyeOff, Eye, Filter } from 'lucide-react';
import type { Transaction, TransactionLink, TransactionSource } from '../../types/transaction';
import { CategoryChip } from '../chips/CategoryChip';
import { SourceChip } from '../chips/SourceChip';
import { LinkBadge, getLinkLabel } from '../chips/LinkBadge';
import { formatBRL, formatShortDate } from '../../format/intl';
import { SOURCE_LABELS } from '../../domain/labels';

type SortKey = 'date' | 'description' | 'category' | 'source' | 'amount';
type SortDir = 'asc' | 'desc';

interface TransactionsTableProps {
  txs: Transaction[];
  /** Mapa de todas as transações por ID — necessário para exibir detalhes de links */
  txIndex?: Map<string, Transaction>;
  compact?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
}

export function TransactionsTable({
  txs,
  txIndex,
  compact,
  showPagination,
  pageSize = 50,
  emptyMessage = 'Nenhuma transação para o filtro selecionado.',
}: TransactionsTableProps) {
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedSources, setSelectedSources] = useState<Set<TransactionSource> | null>(null);

  const availableSources = useMemo(() => {
    const set = new Set<TransactionSource>();
    txs.forEach((t) => set.add(t.source));
    return [...set].sort((a, b) =>
      (SOURCE_LABELS[a]?.label ?? a).localeCompare(
        SOURCE_LABELS[b]?.label ?? b,
        'pt',
      ),
    );
  }, [txs]);

  const sourceFiltered = useMemo(
    () =>
      selectedSources === null
        ? txs
        : txs.filter((t) => selectedSources.has(t.source)),
    [txs, selectedSources],
  );

  const toggleSource = (src: TransactionSource) => {
    setPage(0);
    setSelectedSources((prev) => {
      const base = prev ?? new Set(availableSources);
      const next = new Set(base);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      if (next.size === availableSources.length) return null;
      return next;
    });
  };

  const clearSourceFilter = () => {
    setPage(0);
    setSelectedSources(null);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'amount' || key === 'date' ? 'desc' : 'asc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...sourceFiltered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'date': {
          if (a.date !== b.date) return a.date.localeCompare(b.date) * dir;
          return a.created_at.localeCompare(b.created_at) * dir;
        }
        case 'description':
          return a.description_clean.localeCompare(b.description_clean, 'pt') * dir;
        case 'category':
          return (a.category ?? '').localeCompare(b.category ?? '', 'pt') * dir;
        case 'source': {
          const la = SOURCE_LABELS[a.source]?.label ?? a.source;
          const lb = SOURCE_LABELS[b.source]?.label ?? b.source;
          return la.localeCompare(lb, 'pt') * dir;
        }
        case 'amount':
          return (a.amount - b.amount) * dir;
        default:
          return 0;
      }
    });
    return copy;
  }, [sourceFiltered, sortKey, sortDir]);

  const visible = useMemo(
    () => (showSettled ? sorted : sorted.filter((t) => !t._fullySettled)),
    [sorted, showSettled],
  );

  const settledCount = useMemo(
    () => sorted.filter((t) => t._fullySettled).length,
    [sorted],
  );

  const total = visible.length;
  const totalPages = showPagination
    ? Math.max(1, Math.ceil(total / pageSize))
    : 1;
  const slice = showPagination
    ? visible.slice(page * pageSize, page * pageSize + pageSize)
    : visible;

  const colSpan = compact ? 4 : 5;

  const activeSourceCount = selectedSources?.size ?? availableSources.length;

  if (txs.length === 0) {
    return (
      <div className="text-on-surface-variant text-sm py-10 text-center">
        {emptyMessage}
      </div>
    );
  }
  const hasSourceFilter = selectedSources !== null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <SourceFilterMenu
          available={availableSources}
          selected={selectedSources}
          onToggle={toggleSource}
          onClear={clearSourceFilter}
          activeCount={activeSourceCount}
          hasFilter={hasSourceFilter}
        />
        {settledCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowSettled((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {showSettled ? (
              <EyeOff size={13} strokeWidth={1.75} />
            ) : (
              <Eye size={13} strokeWidth={1.75} />
            )}
            {showSettled ? 'Ocultar' : 'Mostrar'} anuladas ({settledCount})
          </button>
        ) : null}
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-label uppercase text-on-surface-variant">
            <SortableHeader
              label="Data"
              sortKey="date"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="w-20"
            />
            <SortableHeader
              label="Descrição"
              sortKey="description"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Categoria"
              sortKey="category"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="w-44"
            />
            {!compact && (
              <SortableHeader
                label="Fonte"
                sortKey="source"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="w-36"
              />
            )}
            <SortableHeader
              label="Valor"
              sortKey="amount"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              align="right"
              className="w-36"
            />
          </tr>
        </thead>
        <tbody>
          {slice.length === 0 && (
            <tr>
              <td
                colSpan={colSpan}
                className="py-10 text-center text-on-surface-variant text-sm"
              >
                Nenhuma transação para o filtro selecionado.
              </td>
            </tr>
          )}
          {slice.map((t) => {
            const hasActiveLinks =
              t.links?.some((l) => l.settles) ?? false;
            const isSettled = t._fullySettled === true;
            const isPartial =
              !isSettled &&
              t._originalAmount !== undefined &&
              t._netAmount !== undefined;
            const isExpandable = hasActiveLinks && !!txIndex;
            const isExpanded = expandedId === t.id;

            return (
              <TransactionRow
                key={t.id}
                t={t}
                compact={compact}
                colSpan={colSpan}
                isSettled={isSettled}
                isPartial={isPartial}
                isExpandable={isExpandable}
                isExpanded={isExpanded}
                txIndex={txIndex}
                onToggleExpand={() =>
                  setExpandedId((prev) => (prev === t.id ? null : t.id))
                }
              />
            );
          })}
        </tbody>
      </table>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4">
          <span className="text-label uppercase text-on-surface-variant tabular">
            {page * pageSize + 1}–{page * pageSize + slice.length} de {total}
            <span className="ml-2 opacity-70">
              · Página {page + 1}/{totalPages}
            </span>
          </span>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 rounded-sm bg-surface-container text-on-surface text-sm disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </button>
            <button
              className="px-4 py-1.5 rounded-sm bg-primary text-on-primary text-sm disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Row ───────────── */

interface TransactionRowProps {
  t: Transaction;
  compact?: boolean;
  colSpan: number;
  isSettled: boolean;
  isPartial: boolean;
  isExpandable: boolean;
  isExpanded: boolean;
  txIndex?: Map<string, Transaction>;
  onToggleExpand: () => void;
}

function TransactionRow({
  t,
  compact,
  colSpan,
  isSettled,
  isPartial,
  isExpandable,
  isExpanded,
  txIndex,
  onToggleExpand,
}: TransactionRowProps) {
  // Collect unique settling link types for badges
  const settlingLinks = (t.links ?? []).filter((l) => l.settles);
  const badgeTypes = [...new Set(settlingLinks.map((l) => l.type))];

  return (
    <>
      <tr
        className={clsx(
          'transition-colors',
          isSettled ? 'opacity-40' : 'hover:bg-surface-low',
          isExpandable && 'cursor-pointer',
        )}
        onClick={isExpandable ? onToggleExpand : undefined}
      >
        {/* Data */}
        <td className="py-4 pr-3 text-on-surface-variant tabular text-sm">
          {formatShortDate(t.date)}
        </td>

        {/* Descrição + badges */}
        <td className="py-4 pr-3">
          <div className="flex items-center gap-2">
            {isExpandable && (
              <ChevronRight
                size={14}
                strokeWidth={2}
                className={clsx(
                  'shrink-0 text-on-surface-variant transition-transform',
                  isExpanded && 'rotate-90',
                )}
              />
            )}
            <span
              className={clsx(
                'text-sm truncate max-w-md',
                isSettled
                  ? 'text-on-surface-variant line-through'
                  : 'text-on-surface',
              )}
            >
              {prettyDescription(t.description)}
            </span>
            {badgeTypes.map((lt) => (
              <LinkBadge
                key={lt}
                type={lt}
                settles={true}
              />
            ))}
          </div>
          {t.installment && (
            <div className="text-label uppercase text-on-surface-variant mt-0.5">
              Parcela {t.installment.current}/{t.installment.total}
            </div>
          )}
        </td>

        {/* Categoria */}
        <td className="py-4 pr-3">
          <CategoryChip category={t.category} />
        </td>

        {/* Fonte */}
        {!compact && (
          <td className="py-4 pr-3">
            <SourceChip source={t.source} />
          </td>
        )}

        {/* Valor */}
        <td className="py-4 text-right tabular text-sm">
          {isSettled ? (
            /* Totalmente abatida: original riscado + R$ 0 */
            <div>
              <span className="text-on-surface-variant line-through text-xs">
                {formatBRL(t._originalAmount!)}
              </span>
              <div className="text-on-surface-variant font-semibold">
                R$ 0,00
              </div>
            </div>
          ) : isPartial ? (
            /* Parcialmente abatida: original riscado + net */
            <div>
              <span className="text-on-surface-variant line-through text-xs">
                {formatBRL(t._originalAmount!)}
              </span>
              <div
                className={clsx(
                  'font-semibold',
                  t.amount < 0 ? 'text-expense' : 'text-income',
                )}
              >
                {formatBRL(t.amount)}
              </div>
            </div>
          ) : (
            /* Normal */
            <span
              className={clsx(
                'font-semibold',
                t.amount < 0 ? 'text-expense' : 'text-income',
              )}
            >
              {formatBRL(t.amount)}
            </span>
          )}
        </td>
      </tr>

      {/* Detalhe expandido dos links */}
      {isExpanded && txIndex && (
        <tr>
          <td colSpan={colSpan} className="pb-4 pt-0">
            <div className="ml-8 pl-4 border-l-2 border-primary-container/60 space-y-2">
              {settlingLinks.map((link, i) => {
                const linked = txIndex.get(link.linked_to);
                return (
                  <LinkDetailRow key={i} link={link} linked={linked} />
                );
              })}
              {/* Resumo do netting */}
              <div className="flex items-center gap-4 pt-1 text-xs text-on-surface-variant">
                <span>
                  Original:{' '}
                  <strong className="text-on-surface">
                    {formatBRL(t._originalAmount!)}
                  </strong>
                </span>
                <span>
                  Abatido:{' '}
                  <strong className="text-on-surface">
                    {formatBRL(t._settledTotal!)}
                  </strong>
                </span>
                <span>
                  Líquido:{' '}
                  <strong
                    className={clsx(
                      t._netAmount! < 0
                        ? 'text-expense'
                        : t._netAmount! > 0
                          ? 'text-income'
                          : 'text-on-surface-variant',
                    )}
                  >
                    {formatBRL(t._netAmount!)}
                  </strong>
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ───────────── Link detail row ───────────── */

function LinkDetailRow({
  link,
  linked,
}: {
  link: TransactionLink;
  linked?: Transaction;
}) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <LinkBadge type={link.type} settles={link.settles} />
      <div className="flex-1 min-w-0">
        <span className="text-on-surface-variant">{getLinkLabel(link.type)}</span>
        {link.settled_amount > 0 && (
          <span className="text-primary-dim ml-1.5">
            compensa {formatBRL(link.settled_amount)}
          </span>
        )}
        {linked && (
          <div className="text-on-surface-variant mt-0.5 truncate">
            <span className="opacity-60">vinculado a:</span>{' '}
            <span className="text-on-surface">
              {prettyDescription(linked.description)}
            </span>
            <span className="ml-1.5 tabular">
              ({formatBRL(linked._originalAmount ?? linked.amount)})
            </span>
          </div>
        )}
        {link.note && (
          <div className="text-on-surface-variant opacity-60 mt-0.5 truncate italic">
            {link.note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Sortable header ───────────── */

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className,
}: SortableHeaderProps) {
  const active = activeKey === sortKey;
  return (
    <th
      className={clsx(
        'font-semibold py-3',
        align === 'right' ? 'text-right' : 'text-left pr-3',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={clsx(
          'inline-flex items-center gap-1 uppercase transition-colors select-none',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-on-surface' : 'hover:text-on-surface',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp size={12} strokeWidth={2.5} />
          ) : (
            <ChevronDown size={12} strokeWidth={2.5} />
          )
        ) : (
          <ChevronDown size={12} strokeWidth={2} className="opacity-30" />
        )}
      </button>
    </th>
  );
}

/* ───────────── Source filter menu ───────────── */

interface SourceFilterMenuProps {
  available: TransactionSource[];
  selected: Set<TransactionSource> | null;
  onToggle: (src: TransactionSource) => void;
  onClear: () => void;
  activeCount: number;
  hasFilter: boolean;
}

function SourceFilterMenu({
  available,
  selected,
  onToggle,
  onClear,
  activeCount,
  hasFilter,
}: SourceFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (available.length === 0) return <div />;

  const isChecked = (src: TransactionSource) =>
    selected === null ? true : selected.has(src);

  const label = hasFilter
    ? `Fonte (${activeCount}/${available.length})`
    : 'Fonte';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
          hasFilter
            ? 'border-primary-container bg-primary-container/40 text-primary-dim'
            : 'border-outline-variant text-on-surface-variant hover:text-on-surface',
        )}
      >
        <Filter size={12} strokeWidth={1.75} />
        {label}
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-surface-lowest border border-outline-variant rounded-md shadow-lg py-2">
          <div className="flex items-center justify-between px-3 pb-2 border-b border-outline-variant/60">
            <span className="text-label uppercase text-on-surface-variant">
              Filtrar por fonte
            </span>
            {hasFilter && (
              <button
                type="button"
                onClick={onClear}
                className="text-[10px] uppercase text-primary-dim hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {available.map((src) => {
              const meta = SOURCE_LABELS[src];
              const checked = isChecked(src);
              return (
                <li key={src}>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-low">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(src)}
                      className="accent-primary-dim"
                    />
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta?.color ?? '#888' }}
                    />
                    <span className="text-on-surface truncate">
                      {meta?.label ?? src}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────────── Helpers ───────────── */

function prettyDescription(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length > 64) return trimmed.slice(0, 64) + '…';
  return trimmed;
}
