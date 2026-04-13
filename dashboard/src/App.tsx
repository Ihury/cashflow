import { useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { Footer } from './components/layout/Footer';
import { VisaoGeral } from './pages/VisaoGeral';
import { VisaoMensal } from './pages/VisaoMensal';
import { Analise } from './pages/Analise';
import { useDBMeta } from './data/useTransactions';
import type { Mode } from './domain/modes';

export type PageId = 'visao-geral' | 'visao-mensal' | 'analise';

export default function App() {
  const meta = useDBMeta();
  const [page, setPage] = useState<PageId>('visao-geral');
  const [mode, setMode] = useState<Mode>('liquido');
  const [monthlyMonth, setMonthlyMonth] = useState<Date | null>(null);

  const navigateToMonth = (date: Date) => {
    setMonthlyMonth(date);
    setPage('visao-mensal');
  };

  const handleNavigate = (next: PageId) => {
    if (next === 'visao-mensal') {
      const now = new Date();
      setMonthlyMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setPage(next);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-low text-on-surface">
      <TopBar
        page={page}
        onNavigate={handleNavigate}
        mode={mode}
        onModeChange={setMode}
        lastUpdated={meta.lastUpdated}
      />
      <main>
        {page === 'visao-geral' && (
          <VisaoGeral mode={mode} onNavigateToMonth={navigateToMonth} />
        )}
        {page === 'visao-mensal' && (
          <VisaoMensal
            mode={mode}
            month={monthlyMonth}
            onMonthChange={setMonthlyMonth}
          />
        )}
        {page === 'analise' && <Analise mode={mode} />}
      </main>
      <Footer />
    </div>
  );
}
