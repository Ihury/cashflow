import { useMemo } from 'react';
import { loadTransactions } from './loader';

const db = loadTransactions();

export function useTransactions() {
  return useMemo(() => db.transactions, []);
}

export function useDBMeta() {
  return useMemo(
    () => ({ lastUpdated: db.last_updated, version: db.version }),
    [],
  );
}
