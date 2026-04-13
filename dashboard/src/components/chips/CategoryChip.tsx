import clsx from 'clsx';
import { getCategoryTone } from '../../domain/labels';

interface CategoryChipProps {
  category: string | null;
}

const TONE_CLASSES: Record<ReturnType<typeof getCategoryTone>, string> = {
  primary: 'bg-primary-container text-primary-dim',
  secondary: 'bg-secondary-container text-secondary',
  tertiary: 'bg-tertiary-container text-tertiary',
  neutral: 'bg-surface-container text-on-surface-variant',
};

export function CategoryChip({ category }: CategoryChipProps) {
  const label = category ?? 'Outros';
  const tone = getCategoryTone(category);
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-sm text-label uppercase whitespace-nowrap',
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  );
}
