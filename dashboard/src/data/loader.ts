import rawJson from '../../../data/transactions.json?raw';
import type { TransactionsDB } from '../types/transaction';

function sanitize(raw: string): string {
  return raw
    .replace(/\bNaN\b/g, 'null')
    .replace(/\b-?Infinity\b/g, 'null');
}

export function loadTransactions(): TransactionsDB {
  return JSON.parse(sanitize(rawJson)) as TransactionsDB;
}
