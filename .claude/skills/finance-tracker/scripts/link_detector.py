#!/usr/bin/env python3
"""
Detects simple, deterministic relationships between transactions.

Only handles links that can be reliably detected by heuristics:
  - self_transfer: transfers between the user's own bank accounts
  - test_refund: Pagar.me test checkout pairs (debit + credit)
  - estorno: explicit refunds/chargebacks with keywords in description
  - installment_group: same purchase split across multiple invoice months

Complex links (split_bill, reimbursement, pass_through, debt_chain) are
handled by the AI agent, which has contextual understanding and can
interact with the user for confirmation.
"""

import argparse
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
import sys

# Import utilities from same directory
from utils import load_json, save_json, normalize_text, detect_installment


class LinkDetector:
    def __init__(self, transactions: List[Dict], db_transactions: List[Dict], knowledge_dir: str):
        """
        Initialize the link detector with current transactions and historical database.

        Args:
            transactions: New transactions to link
            db_transactions: Existing transactions in database
            knowledge_dir: Path to knowledge directory
        """
        self.transactions = transactions
        self.db_transactions = db_transactions

        # Deduplicate: build a single list by ID
        seen_ids = set()
        self.all_transactions = []
        for tx in db_transactions + transactions:
            tx_id = tx.get("id")
            if tx_id and tx_id not in seen_ids:
                seen_ids.add(tx_id)
                self.all_transactions.append(tx)

        # Results storage
        self.confirmed_links = []
        self.suggested_links = []

        # Track already-created links to prevent duplicates
        self._seen_link_pairs = set()
        # Track matched transaction IDs (so one expense doesn't match multiple incomes)
        self._matched_ids = set()

    def _add_link(self, link: dict) -> bool:
        """Add link if not duplicate. Returns True if added."""
        pair = (link["transaction_id"], link["linked_to"])
        reverse_pair = (link["linked_to"], link["transaction_id"])
        if pair in self._seen_link_pairs or reverse_pair in self._seen_link_pairs:
            return False
        self._seen_link_pairs.add(pair)
        if link.get("confidence", 0) >= 0.80:
            self.confirmed_links.append(link)
        else:
            self.suggested_links.append(link)
        return True

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string in various formats."""
        if not date_str:
            return None
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None

    def _is_already_linked(self, tx_id: str) -> bool:
        """Check if a transaction ID is already part of a link."""
        return any(tx_id in (p[0], p[1]) for p in self._seen_link_pairs)

    # ──────────────────────────────────────────────
    # 1. Self-transfers between own bank accounts
    # ──────────────────────────────────────────────
    def detect_self_transfers(self):
        """
        Detect transfers between the user's own accounts (PF only).

        Matches: outgoing transfer (type='transfer', amount < 0) with incoming
        transaction containing the user's name (from people.json "self" entry),
        same amount, different account, within 3 days. Skips PJ income (CNPJ prefix).
        """
        from utils import is_pj_income_description

        # Build self-name patterns from people.json
        self_patterns = []
        people = self.knowledge.get("people", {}).get("people", {})
        self_entry = people.get("self", {})
        if self_entry:
            self_patterns = list(self_entry.get("variants", []))
            if self_entry.get("full_name"):
                self_patterns.append(self_entry["full_name"])

        # Collect outgoing transfers
        outgoing = [
            tx for tx in self.all_transactions
            if tx.get("type") == "transfer" and tx.get("amount", 0) < 0
        ]

        for inc_tx in self.transactions:
            if inc_tx.get("amount", 0) <= 0:
                continue

            desc = inc_tx.get("description", "")

            # Must look like a self-transfer candidate (matches user's name)
            if not any(p in desc for p in self_patterns):
                continue

            # Skip PJ income (has CNPJ prefix)
            if is_pj_income_description(desc):
                continue

            inc_amount = inc_tx.get("amount", 0)
            inc_date = self._parse_date(inc_tx.get("date"))
            inc_source = inc_tx.get("source", "")
            if not inc_date:
                continue

            # Find best matching outgoing transfer
            best_match = None
            best_days = 999

            for out_tx in outgoing:
                if inc_tx.get("id") == out_tx.get("id"):
                    continue

                # Skip if already matched
                if out_tx.get("id") in self._matched_ids:
                    continue

                out_amount = abs(out_tx.get("amount", 0))
                out_date = self._parse_date(out_tx.get("date"))
                out_source = out_tx.get("source", "")

                if not out_date:
                    continue

                # Must be different accounts
                if inc_source == out_source:
                    continue

                # Same amount, within 3 days
                days_diff = abs((inc_date - out_date).days)
                if abs(inc_amount - out_amount) < 0.01 and days_diff <= 3:
                    if days_diff < best_days:
                        best_match = out_tx
                        best_days = days_diff

            if best_match:
                link = {
                    "transaction_id": inc_tx.get("id"),
                    "linked_to": best_match.get("id"),
                    "type": "self_transfer",
                    "settles": True,
                    "settled_amount": inc_amount,
                    "confidence": 0.95,
                    "note": f"Transferencia entre contas: {inc_source} <- {best_match.get('source', '?')} (R$ {inc_amount:,.2f})"
                }
                if self._add_link(link):
                    self._matched_ids.add(inc_tx.get("id"))
                    self._matched_ids.add(best_match.get("id"))

    # ──────────────────────────────────────────────
    # 2. Pagar.me test checkout pairs
    # ──────────────────────────────────────────────
    def detect_test_refund(self):
        """
        Detect Pagar.me test checkout pairs (debit + credit of same amount).

        Each income matches at most one expense, and vice-versa, to prevent
        the 6-to-1 linking bug.
        """
        pagarme_income = [
            tx for tx in self.transactions
            if tx.get("amount", 0) > 0 and "Pagar.me" in tx.get("description", "")
        ]
        pagarme_expense = [
            tx for tx in self.all_transactions
            if tx.get("amount", 0) < 0
            and ("Pagar.me" in tx.get("description", "") or "Pg *Aora" in tx.get("description", ""))
        ]

        # Track which expenses have already been matched
        matched_expense_ids = set()

        for inc in pagarme_income:
            inc_date = self._parse_date(inc.get("date"))
            inc_amount = inc.get("amount", 0)
            if not inc_date:
                continue

            # Skip if this income is already linked
            if inc.get("id") in self._matched_ids:
                continue

            best_match = None
            best_days = 999

            for exp in pagarme_expense:
                if inc.get("id") == exp.get("id"):
                    continue
                if exp.get("id") in matched_expense_ids:
                    continue
                if exp.get("id") in self._matched_ids:
                    continue

                exp_date = self._parse_date(exp.get("date"))
                if not exp_date:
                    continue
                exp_amount = abs(exp.get("amount", 0))
                days_diff = abs((inc_date - exp_date).days)

                if abs(inc_amount - exp_amount) < 0.01 and days_diff <= 5:
                    if days_diff < best_days:
                        best_match = exp
                        best_days = days_diff

            if best_match:
                link = {
                    "transaction_id": inc.get("id"),
                    "linked_to": best_match.get("id"),
                    "type": "test_refund",
                    "settles": True,
                    "settled_amount": inc_amount,
                    "confidence": 0.95,
                    "note": f"Pagar.me test checkout pair (R$ {inc_amount:.2f})"
                }
                if self._add_link(link):
                    matched_expense_ids.add(best_match.get("id"))
                    self._matched_ids.add(inc.get("id"))
                    self._matched_ids.add(best_match.get("id"))

    # ──────────────────────────────────────────────
    # 3. Estornos (explicit refunds with keywords)
    # ──────────────────────────────────────────────
    def detect_estornos(self):
        """
        Detect estornos: credits with refund keywords matching a previous debit
        of the same amount from the same institution/merchant.

        Only triggers when description explicitly contains 'Estorno', 'Credito de',
        'Devolucao', or 'Reembolso'.
        """
        estorno_keywords = ["Estorno", "Crédito de", "Devolução", "Reembolso",
                            "ESTORNO", "CREDITO DE", "DEVOLUCAO", "REEMBOLSO"]

        for tx in self.transactions:
            description = tx.get("description", "")

            # Must have an estorno keyword AND be positive (credit)
            is_estorno = any(keyword.lower() in description.lower() for keyword in estorno_keywords)
            if not is_estorno or tx.get("amount", 0) <= 0:
                continue

            # Skip if already linked
            if self._is_already_linked(tx.get("id")):
                continue

            amount = tx.get("amount", 0)
            tx_date = self._parse_date(tx.get("date"))
            tx_source = tx.get("source", "")
            if not tx_date:
                continue

            # Look for matching debit within 90 days before
            start_date = tx_date - timedelta(days=90)

            best_match = None
            best_days = 999

            for candidate_tx in self.all_transactions:
                if candidate_tx.get("amount", 0) >= 0:
                    continue
                if tx.get("id") == candidate_tx.get("id"):
                    continue
                if candidate_tx.get("id") in self._matched_ids:
                    continue

                candidate_date = self._parse_date(candidate_tx.get("date"))
                if not candidate_date or candidate_date > tx_date or candidate_date < start_date:
                    continue

                candidate_amount = abs(candidate_tx.get("amount", 0))

                # Must match amount exactly
                if abs(amount - candidate_amount) >= 0.01:
                    continue

                # Prefer same source (same institution)
                days_diff = abs((tx_date - candidate_date).days)
                same_source = tx_source == candidate_tx.get("source", "")

                if same_source and days_diff < best_days:
                    best_match = candidate_tx
                    best_days = days_diff
                elif not best_match and days_diff < best_days:
                    best_match = candidate_tx
                    best_days = days_diff

            if best_match:
                candidate_desc = best_match.get("description", "")
                link = {
                    "transaction_id": tx.get("id"),
                    "linked_to": best_match.get("id"),
                    "type": "estorno",
                    "settles": True,
                    "settled_amount": amount,
                    "confidence": 0.92,
                    "note": f"Estorno de R$ {amount:.2f} referente a: {candidate_desc}"
                }
                if self._add_link(link):
                    self._matched_ids.add(tx.get("id"))
                    self._matched_ids.add(best_match.get("id"))

    # ──────────────────────────────────────────────
    # 4. Installment groups
    # ──────────────────────────────────────────────
    def detect_installment_groups(self):
        """
        Detect installment groups: same description pattern, same amount,
        different invoice months (different invoice_ref AND different dates).

        IMPORTANT: Only auto-links transactions that have EXPLICIT installment
        markers in their description (e.g., "1/3", "2/10", "Pcl4de12",
        "Parcelado em 2 de 5"). Transactions with the same name and amount
        but WITHOUT installment markers are NOT auto-linked — they may be
        subscriptions (assinaturas) or coincidences, and are instead reported
        as ambiguous candidates for the agent to review with the user.

        Avoids self-linking by requiring different IDs, different invoice_ref,
        and at least 20 days apart (installments are monthly).
        Also requires transactions to be on the SAME card (source) — a real
        installment series stays on the card where the purchase was made.
        """
        import re

        # Patterns that indicate explicit installments
        INSTALLMENT_PATTERNS = [
            re.compile(r'\d+/\d+'),                     # "1/3", "2/10"
            re.compile(r'Pcl\d+de\d+', re.IGNORECASE),  # "Pcl4de12"
            re.compile(r'Parcelado?\s+em\s+\d+\s+de\s+\d+', re.IGNORECASE),  # "Parcelado em 2 de 5"
            re.compile(r'\d+\s+de\s+\d+'),              # "2 de 5"
        ]

        def has_installment_marker(desc: str) -> bool:
            """Check if description has explicit installment numbering."""
            return any(p.search(desc) for p in INSTALLMENT_PATTERNS)

        # Group by normalized description pattern (remove installment numbering)
        # Separate into confirmed installments vs ambiguous candidates
        installment_groups: Dict[str, List[Dict]] = {}
        ambiguous_groups: Dict[str, List[Dict]] = {}

        for tx in self.all_transactions:
            desc = tx.get("description", "")
            if not desc:
                continue

            # Only consider credit card expenses (installments appear on card invoices)
            if tx.get("account_type") != "credit_card":
                continue

            # Remove installment numbering patterns like "1/3", "2/3", "(1 de 3)", "Pcl4de12"
            normalized = re.sub(r'\s*\d+/\d+\s*', ' ', desc)
            normalized = re.sub(r'\s*\(\d+\s+de\s+\d+\)\s*', ' ', normalized)
            normalized = re.sub(r'\s*Pcl\d+de\d+', '', normalized, flags=re.IGNORECASE)
            normalized = normalize_text(normalized).strip()

            if not normalized:
                continue

            # Route to the correct group based on whether it has installment markers
            if has_installment_marker(desc):
                if normalized not in installment_groups:
                    installment_groups[normalized] = []
                installment_groups[normalized].append(tx)
            else:
                if normalized not in ambiguous_groups:
                    ambiguous_groups[normalized] = []
                ambiguous_groups[normalized].append(tx)

        # Process CONFIRMED installment groups (have X/Y markers)
        for normalized_desc, txs in installment_groups.items():
            if len(txs) < 2:
                continue

            # Group by amount
            amounts: Dict[float, List[Dict]] = {}
            for tx in txs:
                amount = round(tx.get("amount", 0), 2)
                if amount not in amounts:
                    amounts[amount] = []
                amounts[amount].append(tx)

            for amount, matching_txs in amounts.items():
                if len(matching_txs) < 2:
                    continue

                # Sort by date for sequential pairing
                matching_txs.sort(key=lambda t: t.get("date", ""))

                for i in range(len(matching_txs) - 1):
                    tx_a = matching_txs[i]
                    tx_b = matching_txs[i + 1]

                    # Must be different transactions
                    if tx_a.get("id") == tx_b.get("id"):
                        continue

                    # Must be on the same card (installments don't change cards)
                    if tx_a.get("source") != tx_b.get("source"):
                        continue

                    # Must have different invoice_ref
                    ref_a = tx_a.get("invoice_ref")
                    ref_b = tx_b.get("invoice_ref")
                    if ref_a and ref_b and ref_a == ref_b:
                        continue

                    # Must be at least 20 days apart (installments are monthly)
                    date_a = self._parse_date(tx_a.get("date"))
                    date_b = self._parse_date(tx_b.get("date"))
                    if date_a and date_b:
                        days_apart = abs((date_b - date_a).days)
                        if days_apart < 20:
                            continue

                    link = {
                        "transaction_id": tx_a.get("id"),
                        "linked_to": tx_b.get("id"),
                        "type": "installment_group",
                        "settles": False,
                        "settled_amount": 0,
                        "confidence": 0.90,
                        "note": f"Parcela de {normalized_desc} (R$ {amount:.2f})"
                    }
                    self._add_link(link)

        # Collect AMBIGUOUS candidates (same name+amount, no installment marker)
        # These go into suggested_links for the agent to review with the user
        for normalized_desc, txs in ambiguous_groups.items():
            if len(txs) < 2:
                continue

            # Group by amount AND source (same card)
            key_groups: Dict[tuple, List[Dict]] = {}
            for tx in txs:
                amount = round(tx.get("amount", 0), 2)
                source = tx.get("source", "")
                key = (amount, source)
                if key not in key_groups:
                    key_groups[key] = []
                key_groups[key].append(tx)

            for (amount, source), matching_txs in key_groups.items():
                if len(matching_txs) < 2:
                    continue

                # Sort by date
                matching_txs.sort(key=lambda t: t.get("date", ""))

                # Check if consecutive transactions are ~monthly apart
                monthly_pairs = []
                for i in range(len(matching_txs) - 1):
                    tx_a = matching_txs[i]
                    tx_b = matching_txs[i + 1]

                    if tx_a.get("id") == tx_b.get("id"):
                        continue

                    ref_a = tx_a.get("invoice_ref")
                    ref_b = tx_b.get("invoice_ref")
                    if ref_a and ref_b and ref_a == ref_b:
                        continue

                    date_a = self._parse_date(tx_a.get("date"))
                    date_b = self._parse_date(tx_b.get("date"))
                    if date_a and date_b:
                        days_apart = abs((date_b - date_a).days)
                        if days_apart < 20:
                            continue
                        monthly_pairs.append((tx_a, tx_b))

                if monthly_pairs:
                    # Report as ambiguous — could be subscription or installment
                    for tx_a, tx_b in monthly_pairs:
                        link = {
                            "transaction_id": tx_a.get("id"),
                            "linked_to": tx_b.get("id"),
                            "type": "installment_group",
                            "settles": False,
                            "settled_amount": 0,
                            "confidence": 0.50,
                            "note": f"Possível parcela OU assinatura: {normalized_desc} (R$ {amount:.2f}, {source}) — sem marcador X/Y, requer confirmação"
                        }
                        self._add_link(link)

    # ──────────────────────────────────────────────
    # Run all detectors
    # ──────────────────────────────────────────────
    def run(self):
        """Run all link detection algorithms (deterministic only)."""
        print("[LinkDetector] Starting deterministic link detection...")

        self.detect_self_transfers()
        count = len([l for l in self.confirmed_links + self.suggested_links if l['type'] == 'self_transfer'])
        print(f"  - Self-transfers: {count}")

        self.detect_test_refund()
        count = len([l for l in self.confirmed_links + self.suggested_links if l['type'] == 'test_refund'])
        print(f"  - Test refunds (Pagar.me): {count}")

        self.detect_estornos()
        count = len([l for l in self.confirmed_links + self.suggested_links if l['type'] == 'estorno'])
        print(f"  - Estornos: {count}")

        self.detect_installment_groups()
        confirmed_inst = len([l for l in self.confirmed_links if l['type'] == 'installment_group'])
        ambiguous_inst = len([l for l in self.suggested_links if l['type'] == 'installment_group'])
        print(f"  - Installment groups: {confirmed_inst} confirmed (with X/Y marker)")
        if ambiguous_inst:
            print(f"  - Ambiguous (possible subscription/installment): {ambiguous_inst} candidates for review")

        total = len(self.confirmed_links) + len(self.suggested_links)
        print(f"[LinkDetector] Complete: {len(self.confirmed_links)} confirmed, {len(self.suggested_links)} suggested ({total} total)")

    def get_report(self) -> Dict:
        """Generate the links report."""
        return {
            "confirmed_links": self.confirmed_links,
            "suggested_links": self.suggested_links,
            "stats": {
                "auto_linked": len(self.confirmed_links),
                "needs_review": len(self.suggested_links)
            }
        }


def main():
    parser = argparse.ArgumentParser(
        description="Detect deterministic relationships between transactions"
    )
    parser.add_argument(
        "--transactions",
        required=True,
        help="Path to CATEGORIZED.json (new transactions to link)"
    )
    parser.add_argument(
        "--db",
        required=True,
        help="Path to TRANSACTIONS.json (existing database)"
    )
    parser.add_argument(
        "--knowledge",
        required=True,
        help="Path to knowledge directory"
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to output links_report.json"
    )

    args = parser.parse_args()

    # Load data
    print("[LinkDetector] Loading transactions...")
    raw_transactions = load_json(args.transactions)
    if isinstance(raw_transactions, dict):
        transactions = raw_transactions.get("auto_categorized", []) + raw_transactions.get("needs_review", [])
        if not transactions and "new_transactions" in raw_transactions:
            transactions = raw_transactions["new_transactions"]
        if not transactions and "transactions" in raw_transactions:
            transactions = raw_transactions["transactions"]
    elif isinstance(raw_transactions, list):
        transactions = raw_transactions
    else:
        transactions = []

    print(f"  - Loaded {len(transactions)} new transactions")

    raw_db = load_json(args.db)
    if isinstance(raw_db, dict) and "transactions" in raw_db:
        db_transactions = raw_db["transactions"]
    elif isinstance(raw_db, list):
        db_transactions = raw_db
    else:
        db_transactions = []

    print(f"  - Loaded {len(db_transactions)} database transactions")

    # Detect links
    detector = LinkDetector(transactions, db_transactions, args.knowledge)
    detector.run()

    # Save report
    report = detector.get_report()
    save_json(args.output, report)

    print(f"\n[LinkDetector] Report saved to {args.output}")
    print(f"  - Confirmed links: {report['stats']['auto_linked']}")
    print(f"  - Suggested links: {report['stats']['needs_review']}")


if __name__ == "__main__":
    main()
