export type CategoryTone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

/**
 * Mapeamento de categoria → tom visual do chip.
 * - "primary" (sage teal): essenciais do dia-a-dia
 * - "secondary" (azul-frio): infraestrutura
 * - "tertiary" (coral): saúde, cuidados pessoais, lazer
 * - "neutral": fallback
 */
export const CATEGORY_TONE: Record<string, CategoryTone> = {
  // primary — everyday essentials
  Food: 'primary',
  Groceries: 'primary',

  // secondary — infrastructure
  Housing: 'secondary',
  Transport: 'secondary',
  Subscriptions: 'secondary',
  Utilities: 'secondary',

  // tertiary — wellbeing and lifestyle
  Health: 'tertiary',
  Leisure: 'tertiary',
  Shopping: 'tertiary',

  // receitas
  Salary: 'primary',
  Refund: 'secondary',

  Other: 'neutral',
};

/**
 * Categorias de gasto que consideramos "recorrentes/fixas" — tendem a repetir
 * mensalmente sem depender de decisões pontuais do mês.
 */
export const RECURRING_CATEGORIES = new Set<string>([
  'Housing',
  'Subscriptions',
]);
