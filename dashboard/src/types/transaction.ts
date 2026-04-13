export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'invoice_payment'
  | 'benefit_credit';

export type TransactionSource =
  | 'flash'
  | 'conta_btg'
  | 'conta_itau'
  | 'conta_nubank'
  | 'cartao_btg'
  | 'cartao_itau'
  | 'cartao_nubank';

export type AccountType = 'checking' | 'credit_card' | 'benefit';

export type LinkType =
  | 'self_transfer'
  | 'test_refund'
  | 'estorno'
  | 'installment_group'
  | 'split_bill'
  | 'reimbursement'
  | 'pass_through'
  | 'debt_chain'
  | 'overpayment_return'
  | 'loan'
  | 'loan_repayment'
  | 'invoice_payment';

export interface TransactionLink {
  linked_to: string;
  type: LinkType;
  settles: boolean;
  settled_amount: number;
  note?: string | null;
  confidence?: number;
  confirmed?: boolean;
}

export interface Installment {
  current: number;
  total: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  description: string;
  description_clean: string;
  amount: number;
  source: TransactionSource;
  account_type: AccountType;
  category: string | null;
  type: TransactionType;
  counterpart: string | null;
  status: string | null;
  invoice_ref: string | null;
  installment: Installment | null;
  links: TransactionLink[];
  confidence: string;
  notes: string;
  original_data: unknown;
  created_at: string;
  updated_at: string;

  /** Campos de netting — preenchidos pelo applyLinkNetting no modo líquido */
  _originalAmount?: number;
  _netAmount?: number;
  _settledTotal?: number;
  _fullySettled?: boolean;
}

export interface TransactionsDB {
  version: number;
  last_updated: string;
  transactions: Transaction[];
}
