import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategorySlice } from '../../domain/aggregations';
import { CHART_PALETTE } from '../../domain/labels';
import { formatBRL, formatPercent } from '../../format/intl';

interface CategoryDonutProps {
  data: CategorySlice[];
  centerLabel?: string;
  centerValue?: string;
  selectedCategory?: string | null;
  onSelectCategory?: (label: string | null, categories: string[]) => void;
}

export function CategoryDonut({
  data,
  centerLabel,
  centerValue,
  selectedCategory,
  onSelectCategory,
}: CategoryDonutProps) {
  // Dedupe defensivamente por categoria antes de fatiar (caso a fonte envie duplicatas).
  const dedupedMap = new Map<string, CategorySlice>();
  for (const d of data) {
    const existing = dedupedMap.get(d.category);
    if (existing) {
      dedupedMap.set(d.category, {
        category: d.category,
        total: existing.total + d.total,
        share: existing.share + d.share,
      });
    } else {
      dedupedMap.set(d.category, d);
    }
  }
  const slices = [...dedupedMap.values()].sort((a, b) => b.total - a.total);
  const total = slices.reduce((acc, d) => acc + d.total, 0);

  const handleSelect = (label: string) => {
    if (!onSelectCategory) return;
    if (selectedCategory === label) {
      onSelectCategory(null, []);
      return;
    }
    onSelectCategory(label, [label]);
  };
  const interactive = !!onSelectCategory;

  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 items-center">
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={1}
              stroke="none"
              onClick={interactive ? (d: { category: string }) => handleSelect(d.category) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              {slices.map((s, i) => {
                const dimmed = selectedCategory && selectedCategory !== s.category;
                return (
                  <Cell
                    key={i}
                    fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                    opacity={dimmed ? 0.3 : 1}
                  />
                );
              })}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 20, outline: 'none' }}
              contentStyle={{
                background: 'var(--color-surface-lowest)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 6,
                boxShadow: '0 8px 28px rgba(43, 52, 55, 0.12)',
                fontSize: 12,
              }}
              formatter={(v: number, _name, item) => [
                `${formatBRL(v)} · ${formatPercent((item as any).payload.share)}`,
                (item as any).payload.category,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
          <div className="text-label uppercase text-on-surface-variant">
            {centerLabel ?? 'Gasto Total'}
          </div>
          <div className="text-lg font-semibold tabular mt-1">
            {centerValue ?? formatBRL(total)}
          </div>
        </div>
      </div>

      <ul className="space-y-2 min-w-[140px] max-h-[220px] overflow-y-auto pr-2">
        {slices.map((s, i) => {
          const dimmed = selectedCategory && selectedCategory !== s.category;
          const active = selectedCategory === s.category;
          return (
            <li
              key={`${i}-${s.category}`}
              className={`flex items-center gap-2 text-xs transition-opacity ${
                dimmed ? 'opacity-40' : ''
              } ${active ? 'font-semibold' : ''} ${
                interactive ? 'cursor-pointer hover:opacity-80' : ''
              }`}
              onClick={interactive ? () => handleSelect(s.category) : undefined}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
              />
              <span className="text-on-surface-variant truncate flex-1">{s.category}</span>
              <span className="tabular text-on-surface font-medium">
                {formatPercent(s.share)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
