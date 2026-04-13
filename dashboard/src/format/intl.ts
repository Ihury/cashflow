const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const PCT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const LONG_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

export const formatBRL = (n: number): string => BRL.format(n);

export const formatBRLCompact = (n: number): string => BRL_COMPACT.format(n);

export const formatPercent = (n: number): string => PCT.format(n);

export const formatShortDate = (iso: string): string =>
  SHORT_DATE.format(new Date(iso + 'T00:00:00'));

export const formatLongDate = (iso: string): string =>
  LONG_DATE.format(new Date(iso + 'T00:00:00'));

export const formatMonthYear = (d: Date): string => {
  const s = MONTH_YEAR.format(d);
  return s[0].toUpperCase() + s.slice(1);
};

export const formatDelta = (n: number): string => {
  const sign = n >= 0 ? '+' : '';
  return sign + PCT.format(n);
};

/** Strip the symbol but keep the locale digits, e.g. "1.234,56". */
export const formatNumberBRL = (n: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
