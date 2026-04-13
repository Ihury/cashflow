export interface SourceMeta {
  label: string;
  kind: 'bank' | 'card' | 'benefit';
  /** Cor base da marca da instituição (usada no chip). */
  color: string;
  /** Fundo tintado leve para o chip. */
  bg: string;
}

export const SOURCE_LABELS = {
  conta_principal: {
    label: 'Banco Principal',
    kind: 'bank',
    color: '#2f4858',
    bg: 'rgba(47, 72, 88, 0.12)',
  },
  conta_secundaria: {
    label: 'Banco Secundário',
    kind: 'bank',
    color: '#486b7a',
    bg: 'rgba(72, 107, 122, 0.12)',
  },
  cartao_principal: {
    label: 'Cartão Principal',
    kind: 'card',
    color: '#3a6351',
    bg: 'rgba(58, 99, 81, 0.12)',
  },
  cartao_secundario: {
    label: 'Cartão Secundário',
    kind: 'card',
    color: '#5c8374',
    bg: 'rgba(92, 131, 116, 0.12)',
  },
  beneficio_refeicao: {
    label: 'Benefício Refeição',
    kind: 'benefit',
    color: '#7a8c5c',
    bg: 'rgba(122, 140, 92, 0.14)',
  },
} as const satisfies Record<string, SourceMeta>;
