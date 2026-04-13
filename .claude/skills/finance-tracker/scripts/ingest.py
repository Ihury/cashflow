"""
Financial transaction ingestion script.

Parses transaction files (Organizze XLS and Flash CSV) and outputs normalized JSON.
"""

import argparse
import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Any
from collections import defaultdict

try:
    import pandas as pd
    import xlrd
except ImportError:
    print("Error: Required dependencies not found. Install with:")
    print("  pip install pandas xlrd")
    sys.exit(1)

# Import utilities from same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import (
    normalize_text_uppercase,
    parse_date,
    parse_time,
    parse_brazilian_currency,
    generate_transaction_id_from_parts,
    generate_transaction_id_flash,
    detect_installment,
    extract_counterpart,
    normalize_source_name,
    get_account_type,
    is_invoice_payment_description,
    is_self_transfer_description,
    is_benefit_credit_description,
)
from config import load_config


class TransactionIngestor:
    """Base class for transaction ingestion."""

    def __init__(self):
        self.transactions = []

    def ingest(self, filepath: str) -> List[Dict]:
        """Ingest transactions from file. Override in subclasses."""
        raise NotImplementedError

    def normalize_transaction(self, raw_data: Dict) -> Dict:
        """Normalize transaction to standard format."""
        raise NotImplementedError


class OrganizzeIngestor(TransactionIngestor):
    """Ingests Organizze XLS files."""

    CONTA_COLUMNS = ['Data', 'Descrição', 'Categoria', 'Valor', 'Situação', 'Informações adicionais']
    CARTAO_COLUMNS = ['Data', 'Descrição', 'Categoria', 'Valor', 'Fatura', 'Informações adicionais']

    def __init__(self):
        super().__init__()
        self.VALID_SHEETS = load_config("ingest")["valid_sheets"]

    def ingest(self, filepath: str) -> List[Dict]:
        """
        Ingest Organizze XLS file.

        Args:
            filepath: Path to XLS file

        Returns:
            List of normalized transactions
        """
        self.transactions = []

        try:
            xls = pd.ExcelFile(filepath)
        except Exception as e:
            print(f"Error reading XLS file: {e}")
            return []

        # Process each valid sheet (skip Flash)
        for sheet_name in xls.sheet_names:
            if sheet_name == 'Flash':
                continue

            if sheet_name not in self.VALID_SHEETS:
                continue

            try:
                df = pd.read_excel(filepath, sheet_name=sheet_name)
                transactions_from_sheet = self._process_sheet(df, sheet_name)
                self.transactions.extend(transactions_from_sheet)
            except Exception as e:
                print(f"Error processing sheet '{sheet_name}': {e}")
                continue

        return self.transactions

    def _process_sheet(self, df: pd.DataFrame, sheet_name: str) -> List[Dict]:
        """Process a single sheet and return transactions."""
        transactions = []

        # Track duplicates for occurrence indexing
        dup_tracker = defaultdict(int)

        for idx, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row.get('Data')):
                    continue

                # Build raw data dict
                raw_data = {
                    'source': sheet_name,
                    'data': row.get('Data'),
                    'descricao': row.get('Descrição'),
                    'categoria': row.get('Categoria'),
                    'valor': row.get('Valor'),
                    'situacao': row.get('Situação'),
                    'informacoes_adicionais': row.get('Informações adicionais'),
                    'fatura': row.get('Fatura'),  # For cartão sheets
                }

                # Detect duplicate for occurrence_index
                dup_key = (raw_data['data'], raw_data['descricao'], raw_data['valor'])
                occurrence_index = dup_tracker[dup_key]
                dup_tracker[dup_key] += 1

                # Normalize transaction
                normalized = self.normalize_transaction(raw_data, occurrence_index)
                if normalized:
                    transactions.append(normalized)
            except Exception as e:
                print(f"Error processing row in '{sheet_name}' at index {idx}: {e}")
                continue

        return transactions

    def normalize_transaction(self, raw_data: Dict, occurrence_index: int = 0) -> Optional[Dict]:
        """Normalize Organizze transaction."""
        # Parse date
        date_str = str(raw_data['data']).strip() if raw_data['data'] else None
        date = parse_date(date_str, 'DD.MM.YYYY') if date_str else None
        if not date:
            return None

        # Parse amount
        amount = parse_brazilian_currency(raw_data['valor'])
        if amount is None:
            return None

        description = str(raw_data['descricao']).strip() if raw_data['descricao'] else ''

        # Handle category: check for NaN, None, empty string, or literal "nan"
        categoria_raw = raw_data['categoria']
        if pd.isna(categoria_raw) or categoria_raw == '' or str(categoria_raw).lower().strip() == 'nan':
            category = None
        else:
            category = str(categoria_raw).strip() if categoria_raw else None

        source = normalize_source_name(raw_data['source'])
        account_type = get_account_type(source)

        # Normalize description
        description_clean = normalize_text_uppercase(description)

        # Extract counterpart
        counterpart = extract_counterpart(description)

        # Detect installment
        installment = detect_installment(description)

        # Detect transaction type
        tx_type = self._detect_transaction_type(amount, description, category, counterpart)

        # For invoice payments, ensure category is None (these are summary records, not expenses)
        if tx_type == 'invoice_payment':
            category = None

        # Get invoice reference
        invoice_ref = None
        fatura = raw_data.get('fatura')
        if fatura and not pd.isna(fatura):
            invoice_ref = str(fatura).strip()

        # Get status
        status = None
        situacao = raw_data.get('situacao')
        if situacao and not pd.isna(situacao):
            status_str = str(situacao).strip()
            if status_str == 'Pago':
                status = 'Pago'

        # Generate ID
        tx_id = generate_transaction_id_from_parts(raw_data['source'], date, description, amount, occurrence_index)

        # Build transaction object
        transaction = {
            'id': tx_id,
            'date': date,
            'time': None,
            'description': description,
            'description_clean': description_clean,
            'amount': amount,
            'source': source,
            'account_type': account_type,
            'category': category,
            'type': tx_type,
            'counterpart': counterpart,
            'status': status,
            'invoice_ref': invoice_ref,
            'installment': installment,
            'links': [],
            'confidence': 'auto',
            'notes': '',
            'original_data': raw_data,
        }

        return transaction

    def _detect_transaction_type(self, amount: float, description: str,
                                 category: Optional[str], counterpart: Optional[str] = None) -> str:
        """Detect transaction type."""
        # Check for invoice payment
        if is_invoice_payment_description(description):
            return 'invoice_payment'

        # Check for self-transfer patterns
        if is_self_transfer_description(description, counterpart):
            if amount < 0:
                # Outgoing to own account = definitely a transfer
                return 'transfer'
            else:
                # Incoming from self — could be PJ income or receiving side of transfer
                # Mark as income initially; link_detector will pair it with outgoing if it's a self-transfer
                return 'income'

        # Check for benefit credit
        if amount > 0 and is_benefit_credit_description(description):
            return 'benefit_credit'

        # Default based on amount
        if amount < 0:
            return 'expense'
        else:
            return 'income'


class FlashIngestor(TransactionIngestor):
    """Ingests Flash CSV files."""

    COLUMNS = ['Data', 'Hora', 'Movimentação', 'Valor', 'Meio de Pagamento', 'Saldo']

    def ingest(self, filepath: str) -> List[Dict]:
        """
        Ingest Flash CSV file.

        Args:
            filepath: Path to CSV file

        Returns:
            List of normalized transactions
        """
        self.transactions = []

        try:
            df = pd.read_csv(filepath)
        except Exception as e:
            print(f"Error reading CSV file: {e}")
            return []

        for idx, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row.get('Data')):
                    continue

                raw_data = {
                    'source': 'Flash',
                    'data': row.get('Data'),
                    'hora': row.get('Hora'),
                    'movimentacao': row.get('Movimentação'),
                    'valor': row.get('Valor'),
                    'meio_pagamento': row.get('Meio de Pagamento'),
                    'saldo': row.get('Saldo'),
                }

                normalized = self.normalize_transaction(raw_data)
                if normalized:
                    self.transactions.append(normalized)
            except Exception as e:
                print(f"Error processing row in Flash CSV at index {idx}: {e}")
                continue

        return self.transactions

    def normalize_transaction(self, raw_data: Dict) -> Optional[Dict]:
        """Normalize Flash transaction."""
        # Parse date
        date_str = str(raw_data['data']).strip() if raw_data['data'] else None
        date = parse_date(date_str, 'DD/MM/YYYY') if date_str else None
        if not date:
            return None

        # Parse time
        time_str = str(raw_data['hora']).strip() if raw_data['hora'] and not pd.isna(raw_data['hora']) else None
        time = parse_time(time_str) if time_str else None

        # Parse amount
        amount = parse_brazilian_currency(raw_data['valor'])
        if amount is None:
            return None

        description = str(raw_data['movimentacao']).strip() if raw_data['movimentacao'] else ''
        source = normalize_source_name(raw_data['source'])
        account_type = get_account_type(source)

        # Normalize description
        description_clean = normalize_text_uppercase(description)

        # Extract counterpart
        counterpart = extract_counterpart(description)

        # Detect installment
        installment = detect_installment(description)

        # Detect transaction type
        tx_type = self._detect_transaction_type(amount, description)

        # Generate ID
        tx_id = generate_transaction_id_flash(date, time or '', description, amount)

        # Build transaction object
        transaction = {
            'id': tx_id,
            'date': date,
            'time': time,
            'description': description,
            'description_clean': description_clean,
            'amount': amount,
            'source': source,
            'account_type': account_type,
            'category': None,
            'type': tx_type,
            'counterpart': counterpart,
            'status': None,
            'invoice_ref': None,
            'installment': installment,
            'links': [],
            'confidence': 'auto',
            'notes': '',
            'original_data': raw_data,
        }

        return transaction

    def _detect_transaction_type(self, amount: float, description: str) -> str:
        """Detect transaction type."""
        # Check for benefit credit
        if amount > 0 and is_benefit_credit_description(description):
            return 'benefit_credit'

        # Default based on amount
        if amount < 0:
            return 'expense'
        else:
            return 'income'


def detect_source_type(filepath: str) -> str:
    """
    Auto-detect source type based on file extension.

    Args:
        filepath: Path to input file

    Returns:
        'organizze' or 'flash'
    """
    ext = Path(filepath).suffix.lower()
    if ext == '.xls' or ext == '.xlsx':
        return 'organizze'
    elif ext == '.csv':
        return 'flash'
    else:
        # Default to organizze for unknown
        return 'organizze'


def ingest_file(filepath: str, source_type: Optional[str] = None) -> List[Dict]:
    """
    Ingest transaction file.

    Args:
        filepath: Path to input file
        source_type: 'organizze' or 'flash'. If None, auto-detect.

    Returns:
        List of normalized transactions
    """
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return []

    # Auto-detect if not specified
    if source_type is None:
        source_type = detect_source_type(filepath)

    if source_type == 'organizze':
        ingestor = OrganizzeIngestor()
    elif source_type == 'flash':
        ingestor = FlashIngestor()
    else:
        print(f"Error: Unknown source type: {source_type}")
        return []

    return ingestor.ingest(filepath)


def save_transactions(transactions: List[Dict], output_path: str) -> None:
    """
    Save transactions to JSON file.

    Args:
        transactions: List of transaction dictionaries
        output_path: Output file path
    """
    try:
        # Remove original_data before saving (optional, for smaller files)
        # for tx in transactions:
        #     tx.pop('original_data', None)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)

        print(f"Saved {len(transactions)} transactions to {output_path}")
    except Exception as e:
        print(f"Error saving transactions: {e}")
        sys.exit(1)


def print_summary(transactions: List[Dict]) -> None:
    """
    Print summary statistics.

    Args:
        transactions: List of transactions
    """
    # Count by source
    by_source = defaultdict(int)
    by_type = defaultdict(int)

    for tx in transactions:
        by_source[tx['source']] += 1
        by_type[tx['type']] += 1

    print("\n=== INGESTION SUMMARY ===")
    print(f"Total transactions: {len(transactions)}")

    print("\nTransactions by source:")
    for source in sorted(by_source.keys()):
        print(f"  {source}: {by_source[source]}")

    print("\nTransactions by type:")
    for tx_type in sorted(by_type.keys()):
        print(f"  {tx_type}: {by_type[tx_type]}")

    # Calculate totals
    total_expenses = sum(tx['amount'] for tx in transactions if tx['amount'] < 0)
    total_income = sum(tx['amount'] for tx in transactions if tx['amount'] > 0)

    print(f"\nTotal expenses: R$ {total_expenses:,.2f}")
    print(f"Total income: R$ {total_income:,.2f}")
    print(f"Net: R$ {total_income + total_expenses:,.2f}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Parse financial transaction files and output normalized JSON.'
    )
    parser.add_argument('--input', required=True, help='Input file path (XLS or CSV)')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    parser.add_argument(
        '--source-type',
        choices=['organizze', 'flash'],
        default=None,
        help='Source type (auto-detected if not specified)',
    )

    args = parser.parse_args()

    # Ingest transactions
    print(f"Ingesting transactions from {args.input}...")
    transactions = ingest_file(args.input, args.source_type)

    if not transactions:
        print("No transactions found.")
        sys.exit(0)

    # Save to output file
    save_transactions(transactions, args.output)

    # Print summary
    print_summary(transactions)


if __name__ == '__main__':
    main()
