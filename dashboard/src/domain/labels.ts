export { SOURCE_LABELS, type SourceMeta } from '../config/personal.local';

/**
 * Mapeamento de categoria → tom visual do chip.
 * - "primary" (sage teal): essenciais do dia-a-dia (alimentação, mercado)
 * - "secondary" (azul-frio): infraestrutura (casa, transporte, trabalho)
 * - "tertiary" (coral): saúde, cuidados pessoais, lazer
 * - "neutral": fallback (Outros)
 */
export type CategoryTone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

export const CATEGORY_TONE: Record<string, CategoryTone> = {
  // primary — essenciais alimentares
  Alimentação: 'primary',
  'Bares e restaurantes': 'primary',
  Mercado: 'primary',
  'Benefício alimentação': 'primary',

  // secondary — infraestrutura e trabalho
  Casa: 'secondary',
  Transporte: 'secondary',
  Trabalho: 'secondary',
  'Assinaturas e serviços': 'secondary',
  Educação: 'secondary',
  'Impostos e Taxas': 'secondary',

  // tertiary — bem-estar e lifestyle
  Saúde: 'tertiary',
  'Cuidados pessoais': 'tertiary',
  'Lazer e hobbies': 'tertiary',
  Roupas: 'tertiary',
  Compras: 'tertiary',
  'Presentes e doações': 'tertiary',
  Viagem: 'tertiary',

  // dívidas/empréstimos
  'Dívidas e empréstimos': 'tertiary',
  Empréstimos: 'tertiary',

  // receitas
  Salário: 'primary',
  Reembolso: 'secondary',
  'Divisão de conta': 'secondary',
  Rendimento: 'primary',
  'Freelance/Extra': 'primary',
  'Outras receitas': 'neutral',

  Outros: 'neutral',
};

export function getCategoryTone(category: string | null): CategoryTone {
  if (!category) return 'neutral';
  return CATEGORY_TONE[category] ?? 'neutral';
}

/**
 * Categorias de gasto que consideramos "recorrentes/fixas" — tendem a repetir
 * mensalmente sem depender de decisões pontuais do mês.
 */
export const RECURRING_CATEGORIES = new Set<string>([
  'Casa',
  'Assinaturas e serviços',
]);

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
