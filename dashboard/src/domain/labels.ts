export { SOURCE_LABELS, type SourceMeta } from '../config/personal.local';
export {
  CATEGORY_TONE,
  RECURRING_CATEGORIES,
} from '../config/categories.local';
export type { CategoryTone } from '../config/categories.local';

import { CATEGORY_TONE } from '../config/categories.local';
import type { CategoryTone } from '../config/categories.local';

export function getCategoryTone(category: string | null): CategoryTone {
  if (!category) return 'neutral';
  return CATEGORY_TONE[category] ?? 'neutral';
}

/** Paleta cíclica usada nos donuts e barras (na ordem de prioridade visual). */
export const CHART_PALETTE = [
  '#396660', // primary
  '#805353', // tertiary
  '#466370', // secondary
  '#2d5a55', // primary-dim
  '#bcece4', // primary-container
  '#fec3c3', // tertiary-container
  '#c9e7f7', // secondary-container
  '#737c7f', // outline
  '#abb3b7', // outline-variant
  '#dbe4e7', // surface-highest
] as const;
