import { Search } from 'lucide-react';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchFilter({ value, onChange, placeholder }: SearchFilterProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        strokeWidth={1.75}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Filtrar descrição…'}
        className="bg-surface-container rounded-sm pl-8 pr-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-high transition-colors w-64"
      />
    </div>
  );
}
