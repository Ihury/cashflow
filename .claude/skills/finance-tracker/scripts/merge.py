#!/usr/bin/env python3
"""
Merge new transactions into existing database with deduplication and detection logic.

Handles:
- Deduplication by ID and conflict detection
- Self-transfer detection (same person, multiple accounts)
- Invoice payment detection and linking
- Comprehensive merge report generation
"""

import json
import argparse
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import os

# Import utils from same directory
sys.path.insert(0, str(Path(__file__).parent))
from utils import (
    load_json,
    save_json,
    normalize_text,
    is_invoice_payment_description,
    is_self_transfer_description,
    match_person_name,
)
from config import load_config


@dataclass
class MergeReport:
    """Structure for the merge report"""

    new_transactions: List[Dict[str, Any]]
    duplicates: List[Dict[str, Any]]
    conflicts: List[Dict[str, Any]]
    self_transfers: List[Dict[str, Any]]
    invoice_payments: List[Dict[str, Any]]
    stats: Dict[str, int]


class TransactionMerger:
    """Merges new transactions into existing database"""

    def __init__(self, db_transactions: List[Dict], knowledge_dir: Optional[str] = None):
        """
        Initialize merger with existing transactions.

        Args:
            db_transactions: List of existing transactions from database
            knowledge_dir: Optional directory containing knowledge files
        """
        self.db_transactions = db_transactions
        self.knowledge_dir = knowledge_dir
        # Build index by ID for faster lookups
        self.db_by_id = {tx.get("id"): tx for tx in db_transactions if tx.get("id")}
        # Build index by (date, account) for self-transfer detection
        self.db_by_date_account = {}
        for tx in db_transactions:
            key = (tx.get("date"), tx.get("account"))
            if key not in self.db_by_date_account:
                self.db_by_date_account[key] = []
            self.db_by_date_account[key].append(tx)

    def merge(self, new_transactions: List[Dict[str, Any]]) -> MergeReport:
        """
        Merge new transactions into database.

        Args:
            new_transactions: List of newly ingested transactions

        Returns:
            MergeReport with merge results and statistics
        """
        new_txs = []
        duplicates = []
        conflicts = []
        self_transfers = []
        invoice_payments = []

        for new_tx in new_transactions:
            result = self._process_transaction(new_tx)

            if result["type"] == "duplicate":
                duplicates.append(result["data"])
            elif result["type"] == "conflict":
                conflicts.append(result["data"])
            elif result["type"] == "new":
                new_txs.append(new_tx)

        # Detect self-transfers across new and existing transactions
        self_transfers = self._detect_self_transfers(new_txs + self.db_transactions)

        # Detect invoice payments and link to card transactions
        invoice_payments = self._detect_invoice_payments(new_txs + self.db_transactions)

        # Calculate statistics
        stats = {
            "total_ingested": len(new_transactions),
            "new": len(new_txs),
            "duplicates": len(duplicates),
            "conflicts": len(conflicts),
            "self_transfers": len(self_transfers),
            "invoice_payments": len(invoice_payments),
        }

        return MergeReport(
            new_transactions=new_txs,
            duplicates=duplicates,
            conflicts=conflicts,
            self_transfers=self_transfers,
            invoice_payments=invoice_payments,
            stats=stats,
        )

    def _process_transaction(self, new_tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single new transaction for duplicates and conflicts.

        Returns dict with type and data:
        - {"type": "duplicate", "data": {...}}
        - {"type": "conflict", "data": {...}}
        - {"type": "new", "data": {...}}
        """
        new_id = new_tx.get("id")
        new_date = new_tx.get("date")
        new_amount = new_tx.get("amount")
        new_desc = new_tx.get("description", "")

        # Primary check: exact ID match
        if new_id and new_id in self.db_by_id:
            return {
                "type": "duplicate",
                "data": {
                    "new": new_tx,
                    "existing_id": new_id,
                },
            }

        # Secondary check: similar transaction (date + amount + description)
        # but different ID → conflict
        normalized_new_desc = normalize_text(new_desc)

        for existing_tx in self.db_transactions:
            existing_date = existing_tx.get("date")
            existing_amount = existing_tx.get("amount")
            existing_desc = existing_tx.get("description", "")
            existing_id = existing_tx.get("id")

            # Skip if same ID (already handled above)
            if new_id == existing_id:
                continue

            # Check if date matches
            if new_date != existing_date:
                continue

            # Check if amounts are similar (within 0.01)
            if new_amount is not None and existing_amount is not None:
                if abs(float(new_amount) - float(existing_amount)) > 0.01:
                    continue
            else:
                continue

            # Check if descriptions are similar
            normalized_existing_desc = normalize_text(existing_desc)
            if normalized_new_desc != normalized_existing_desc:
                continue

            # All checks match → conflict
            return {
                "type": "conflict",
                "data": {
                    "new": new_tx,
                    "existing": existing_tx,
                    "reason": "same date, amount, and description but different ID",
                },
            }

        # No duplicates or conflicts
        return {"type": "new", "data": new_tx}

    def _detect_self_transfers(
        self, all_transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect self-transfers (same person between own accounts).

        A self-transfer is:
        - Type = "transfer"
        - User's own name in description (from people.json "self" entry)
        - One outgoing (negative) in one account
        - One incoming (positive) in another account
        - Same date and absolute amount
        """
        self_transfers = []
        processed_pairs = set()

        for tx in all_transactions:
            # Skip if not a transfer or already paired
            if tx.get("type") != "transfer" or tx.get("id") in processed_pairs:
                continue

            # Check if self-transfer description
            if not is_self_transfer_description(tx.get("description", "")):
                continue

            tx_id = tx.get("id")
            tx_amount = float(tx.get("amount", 0))
            tx_date = tx.get("date")
            tx_account = tx.get("account")

            # Look for matching pair
            for other_tx in all_transactions:
                if other_tx.get("id") == tx_id or other_tx.get("id") in processed_pairs:
                    continue

                other_amount = float(other_tx.get("amount", 0))
                other_date = other_tx.get("date")
                other_account = other_tx.get("account")

                # Check for matching pair: opposite amounts, same date, different account
                if (
                    other_date == tx_date
                    and tx_account != other_account
                    and abs(tx_amount + other_amount) < 0.01
                    and is_self_transfer_description(other_tx.get("description", ""))
                ):
                    # Found pair
                    from_tx = tx if tx_amount < 0 else other_tx
                    to_tx = other_tx if tx_amount < 0 else tx

                    self_transfers.append(
                        {
                            "from": from_tx,
                            "to": to_tx,
                            "amount": abs(tx_amount),
                            "date": tx_date,
                        }
                    )

                    processed_pairs.add(tx_id)
                    processed_pairs.add(other_tx.get("id"))
                    break

        return self_transfers

    def _detect_invoice_payments(
        self, all_transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect invoice payment transactions and link to card transactions.

        Patterns (configure in patterns.json → invoice_patterns):
        - "FATURA PAGA BANCO X" in conta_banco → pays cartao_banco
        - "Pagamento de fatura" in conta_banco → pays cartao_banco
        - "Fatura X 2026" with no category → invoice summary
        """
        invoice_payments = []
        processed_payments = set()

        # Payment account → card account mappings
        payment_to_card = load_config("accounts")["payment_to_card"]

        for tx in all_transactions:
            if tx.get("id") in processed_payments:
                continue

            tx_desc = tx.get("description", "")
            tx_account = tx.get("account", "")
            tx_date = tx.get("date")
            tx_amount = tx.get("amount", 0)

            # Check if this is an invoice payment
            if not is_invoice_payment_description(tx_desc):
                continue

            # Determine which card account(s) this payment is for
            card_accounts = payment_to_card.get(tx_account, [])
            if isinstance(card_accounts, str):
                card_accounts = [card_accounts]

            # Find all card transactions from this invoice period
            # Match by: date within invoice period + same card account + amount in similar range
            invoice_items = []

            for card_tx in all_transactions:
                card_account = card_tx.get("account", "")
                card_date = card_tx.get("date")
                card_amount = card_tx.get("amount", 0)

                # Check if card transaction matches this payment
                if card_account not in card_accounts:
                    continue

                # Check if date is in expected invoice period (rough heuristic)
                # Card transactions should be from previous month(s)
                if card_date and tx_date:
                    # Simple heuristic: within 60 days before payment
                    from datetime import datetime, timedelta

                    try:
                        payment_dt = datetime.strptime(tx_date, "%Y-%m-%d")
                        card_dt = datetime.strptime(card_date, "%Y-%m-%d")
                        days_diff = (payment_dt - card_dt).days
                        if days_diff < 0 or days_diff > 60:
                            continue
                    except (ValueError, TypeError):
                        pass

                invoice_items.append(card_tx)

            if invoice_items:
                invoice_payments.append(
                    {
                        "payment": tx,
                        "invoice_items": invoice_items,
                        "count": len(invoice_items),
                    }
                )
                processed_payments.add(tx.get("id"))

        return invoice_payments


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Merge new transactions into existing database with deduplication"
    )
    parser.add_argument(
        "--new",
        required=True,
        help="Path to newly ingested transactions (from ingest.py)",
    )
    parser.add_argument(
        "--db",
        required=True,
        help="Path to existing transactions database",
    )
    parser.add_argument(
        "--knowledge",
        help="Path to knowledge directory",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to output merge report",
    )

    args = parser.parse_args()

    # Load existing database (or empty if doesn't exist)
    db_path = Path(args.db)
    if db_path.exists():
        db_data = load_json(str(db_path))
        if isinstance(db_data, dict) and "transactions" in db_data:
            existing_txs = db_data["transactions"]
        elif isinstance(db_data, list):
            existing_txs = db_data
        else:
            existing_txs = []
            print(f"Warning: {args.db} format not recognized, treating as empty")
    else:
        existing_txs = []
        print(f"Note: Database {args.db} does not exist, treating as empty (first run)")

    # Load new ingested transactions
    new_path = Path(args.new)
    if not new_path.exists():
        print(f"Error: {args.new} not found", file=sys.stderr)
        sys.exit(1)

    new_txs = load_json(str(new_path))
    if not isinstance(new_txs, list):
        print(f"Error: {args.new} must contain a list of transactions", file=sys.stderr)
        sys.exit(1)

    # Run merge
    merger = TransactionMerger(existing_txs, args.knowledge)
    report = merger.merge(new_txs)

    # Save report
    report_dict = {
        "new_transactions": report.new_transactions,
        "duplicates": report.duplicates,
        "conflicts": report.conflicts,
        "self_transfers": report.self_transfers,
        "invoice_payments": report.invoice_payments,
        "stats": report.stats,
    }

    save_json(str(Path(args.output)), report_dict)
    print(f"Merge report saved to {args.output}")
    print(f"\nSummary:")
    print(f"  Total ingested: {report.stats['total_ingested']}")
    print(f"  New: {report.stats['new']}")
    print(f"  Duplicates: {report.stats['duplicates']}")
    print(f"  Conflicts: {report.stats['conflicts']}")
    print(f"  Self-transfers detected: {report.stats['self_transfers']}")
    print(f"  Invoice payments detected: {report.stats['invoice_payments']}")


if __name__ == "__main__":
    main()
