#!/usr/bin/env python3
"""
Finance Tracker - Commit Script

Commits processed transactions to the main database and updates knowledge base.

Modes:
  Default:         Add new transactions from CATEGORIZED.json
  --edit:          Update a specific transaction field
  --delete:        Remove a transaction by ID
  --add:           Add a manual transaction
  --bulk-categorize: Update category for all transactions from a merchant
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

# Import utils from same directory
from utils import (
    load_json,
    save_json,
    normalize_text,
    generate_transaction_id,
    get_iso_datetime,
    print_transaction_summary,
)


class FinanceCommitter:
    """Handle committing transactions and updating knowledge base."""

    def __init__(self, db_path: str, knowledge_dir: str):
        self.db_path = db_path
        self.knowledge_dir = knowledge_dir
        self.transactions_db = self._load_transactions_db()
        self.merchants_db = load_json(
            f"{knowledge_dir}/merchants.json"
        ) or self._init_merchants_db()
        self.patterns_db = load_json(
            f"{knowledge_dir}/patterns.json"
        ) or self._init_patterns_db()

    def _init_transactions_db(self) -> Dict[str, Any]:
        """Initialize empty transactions database structure."""
        return {
            "version": 1,
            "last_updated": get_iso_datetime(),
            "transactions": [],
        }

    def _init_merchants_db(self) -> Dict[str, Any]:
        """Initialize empty merchants database."""
        return {"version": 1, "merchants": {}}

    def _init_patterns_db(self) -> Dict[str, Any]:
        """Initialize empty patterns database."""
        return {
            "version": 1,
            "recurring": [],
            "installments": [],
        }

    def _load_transactions_db(self) -> Dict[str, Any]:
        """Load transactions database, initialize if not found."""
        db = load_json(self.db_path)
        if not db:
            return self._init_transactions_db()
        if "transactions" not in db:
            db["transactions"] = []
        return db

    def _find_transaction_by_id(self, tx_id: str) -> Optional[Dict[str, Any]]:
        """Find a transaction by ID."""
        for tx in self.transactions_db["transactions"]:
            if tx.get("id") == tx_id:
                return tx
        return None

    def _ensure_bidirectional_links(self, tx: Dict[str, Any], new_links: List[Dict]) -> None:
        """Add links to a transaction, avoiding duplicates by linked_to ID."""
        existing_links = tx.get("links", [])
        if not isinstance(existing_links, list):
            existing_links = []
        existing_linked_ids = {
            l.get("linked_to") for l in existing_links if isinstance(l, dict)
        }
        for link in new_links:
            if link["linked_to"] not in existing_linked_ids:
                existing_links.append(link)
                existing_linked_ids.add(link["linked_to"])
        tx["links"] = existing_links

    def add_bidirectional_link(
        self,
        tx_id_a: str,
        tx_id_b: str,
        link_type: str,
        note: str = "",
        confidence: float = 0.95,
        confirmed: bool = True,
        settles: bool = True,
        settled_amount: Optional[float] = None,
    ) -> bool:
        """
        Add a bidirectional link between two transactions.

        Creates A->B and B->A links with settles/settled_amount.
        If settled_amount is None and settles is True, defaults to min(abs(A), abs(B)).
        Returns True if both transactions exist.
        """
        tx_a = self._find_transaction_by_id(tx_id_a)
        tx_b = self._find_transaction_by_id(tx_id_b)

        if not tx_a or not tx_b:
            missing = tx_id_a if not tx_a else tx_id_b
            print(f"Error: Transaction {missing} not found.")
            return False

        # Default settled_amount: the smaller absolute value of the two
        if settled_amount is None and settles:
            settled_amount = min(abs(tx_a.get("amount", 0)), abs(tx_b.get("amount", 0)))
        elif not settles:
            settled_amount = 0

        link_a_to_b = {
            "linked_to": tx_id_b,
            "type": link_type,
            "settles": settles,
            "settled_amount": settled_amount,
            "note": note,
            "confidence": confidence,
            "confirmed": confirmed,
        }
        link_b_to_a = {
            "linked_to": tx_id_a,
            "type": link_type,
            "settles": settles,
            "settled_amount": settled_amount,
            "note": note,
            "confidence": confidence,
            "confirmed": confirmed,
        }

        self._ensure_bidirectional_links(tx_a, [link_a_to_b])
        self._ensure_bidirectional_links(tx_b, [link_b_to_a])

        tx_a["updated_at"] = get_iso_datetime()
        tx_b["updated_at"] = get_iso_datetime()

        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)

        settle_str = f", settles R${settled_amount:,.2f}" if settles else ", informational"
        print(f"Linked {tx_id_a[:12]}... <-> {tx_id_b[:12]}... ({link_type}{settle_str})")
        return True

    def repair_bidirectional_links(self) -> int:
        """
        Scan all transactions and ensure every link is bidirectional.

        If A has a link to B but B doesn't link back to A, adds the reverse link.
        Returns the number of reverse links added.
        """
        repairs = 0
        txs = self.transactions_db["transactions"]
        tx_by_id = {tx["id"]: tx for tx in txs if "id" in tx}

        for tx in txs:
            for link in tx.get("links", []):
                if not isinstance(link, dict):
                    continue
                target_id = link.get("linked_to")
                if not target_id or target_id not in tx_by_id:
                    continue

                target_tx = tx_by_id[target_id]
                target_links = target_tx.get("links", [])
                if not isinstance(target_links, list):
                    target_links = []
                    target_tx["links"] = target_links

                # Check if reverse link already exists
                has_reverse = any(
                    isinstance(l, dict) and l.get("linked_to") == tx["id"]
                    for l in target_links
                )

                if not has_reverse:
                    reverse_link = {
                        "linked_to": tx["id"],
                        "type": link.get("type", "unknown"),
                        "settles": link.get("settles", False),
                        "settled_amount": link.get("settled_amount", 0),
                        "note": link.get("note", ""),
                        "confidence": link.get("confidence", 0),
                        "confirmed": link.get("confirmed", False),
                    }
                    target_links.append(reverse_link)
                    target_tx["updated_at"] = get_iso_datetime()
                    repairs += 1

        if repairs > 0:
            self.transactions_db["last_updated"] = get_iso_datetime()
            save_json(self.db_path, self.transactions_db)

        return repairs

    def commit_transactions(
        self,
        categorized_path: str,
        links_path: Optional[str] = None,
    ) -> None:
        """
        Add new transactions from categorized.json and apply links from links_report.json.
        """
        # Load categorized transactions
        categorized = load_json(categorized_path)
        if not categorized or "auto_categorized" not in categorized:
            print("Error: No auto_categorized transactions found in file.")
            return

        auto_categorized = categorized["auto_categorized"]
        print(f"Processing {len(auto_categorized)} transactions...")

        # Load links if provided
        links_map = {}  # tx_id -> list of link dicts
        if links_path:
            links_report = load_json(links_path)
            if links_report and "confirmed_links" in links_report:
                for link in links_report["confirmed_links"]:
                    # Support both field names
                    tx_id = link.get("tx_id") or link.get("transaction_id")
                    if not tx_id:
                        continue
                    link_obj = {
                        "linked_to": link["linked_to"],
                        "type": link.get("type", "unknown"),
                        "settles": link.get("settles", True),
                        "settled_amount": link.get("settled_amount", 0),
                        "note": link.get("note", ""),
                        "confidence": link.get("confidence", 0),
                        "confirmed": True,
                    }
                    if tx_id not in links_map:
                        links_map[tx_id] = []
                    links_map[tx_id].append(link_obj)

        # Build reverse links map: for each link A->B, also create B->A
        reverse_links_map = {}  # linked_to_id -> list of reverse link dicts
        for tx_id, link_list in links_map.items():
            for link_obj in link_list:
                target_id = link_obj["linked_to"]
                reverse_link = {
                    "linked_to": tx_id,
                    "type": link_obj.get("type", "unknown"),
                    "note": link_obj.get("note", ""),
                    "confidence": link_obj.get("confidence", 0),
                    "confirmed": link_obj.get("confirmed", True),
                }
                if target_id not in reverse_links_map:
                    reverse_links_map[target_id] = []
                reverse_links_map[target_id].append(reverse_link)

        # Apply reverse links to existing DB transactions
        for target_id, rev_links in reverse_links_map.items():
            existing_tx = self._find_transaction_by_id(target_id)
            if existing_tx:
                self._ensure_bidirectional_links(existing_tx, rev_links)

        # Process each transaction
        added_count = 0
        for tx in auto_categorized:
            # Generate ID if not present
            if "id" not in tx:
                tx["id"] = generate_transaction_id(tx)

            # Skip if already exists
            if self._find_transaction_by_id(tx["id"]):
                print(f"  Skipping {tx['id']} (already exists)")
                continue

            # Apply forward links if available
            if tx["id"] in links_map:
                existing_links = tx.get("links", [])
                if not isinstance(existing_links, list):
                    existing_links = []
                existing_linked_ids = {l.get("linked_to") for l in existing_links if isinstance(l, dict)}
                for new_link in links_map[tx["id"]]:
                    if new_link["linked_to"] not in existing_linked_ids:
                        existing_links.append(new_link)
                tx["links"] = existing_links

            # Apply reverse links (from other transactions pointing to this one)
            if tx["id"] in reverse_links_map:
                self._ensure_bidirectional_links(tx, reverse_links_map[tx["id"]])

            # Set metadata
            tx["created_at"] = tx.get("created_at", get_iso_datetime())
            tx["updated_at"] = get_iso_datetime()
            tx["confidence"] = tx.get("confidence", "auto")

            # Add to database
            self.transactions_db["transactions"].append(tx)

            # Update merchants knowledge
            if "merchant" in tx and "category" in tx:
                self._update_merchant_knowledge(tx["merchant"], tx["category"])

            # Update patterns knowledge
            if tx.get("pattern_type"):
                self._update_pattern_knowledge(tx)

            added_count += 1

        # Save database
        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)
        save_json(f"{self.knowledge_dir}/merchants.json", self.merchants_db)
        save_json(f"{self.knowledge_dir}/patterns.json", self.patterns_db)

        print(f"\nCommitted {added_count} new transactions")
        if added_count > 0:
            print_transaction_summary(auto_categorized[:added_count])

    def edit_transaction(
        self, tx_id: str, field: str, value: Any
    ) -> None:
        """Edit a specific field in a transaction."""
        tx = self._find_transaction_by_id(tx_id)
        if not tx:
            print(f"Error: Transaction {tx_id} not found.")
            return

        old_value = tx.get(field)
        tx[field] = value
        tx["updated_at"] = get_iso_datetime()
        tx["confidence"] = "manual"

        # If changing category, update merchant knowledge
        if field == "category" and "merchant" in tx:
            self._update_merchant_knowledge(tx["merchant"], value)

        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)
        save_json(f"{self.knowledge_dir}/merchants.json", self.merchants_db)

        print(f"Updated transaction {tx_id}")
        print(f"  {field}: {old_value} -> {value}")

    def delete_transaction(self, tx_id: str) -> None:
        """Delete a transaction by ID."""
        tx = self._find_transaction_by_id(tx_id)
        if not tx:
            print(f"Error: Transaction {tx_id} not found.")
            return

        self.transactions_db["transactions"].remove(tx)

        # Remove any links referencing this transaction
        for other_tx in self.transactions_db["transactions"]:
            if "links" in other_tx:
                other_tx["links"] = [
                    link for link in other_tx["links"]
                    if link.get("linked_to") != tx_id
                ]

        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)

        print(f"Deleted transaction {tx_id}")
        print(f"  {tx.get('date')} {tx.get('description')} {tx.get('amount')}")

    def add_manual_transaction(self, tx_json: str) -> None:
        """Add a manual transaction from JSON string."""
        try:
            tx = json.loads(tx_json)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}")
            return

        # Validate required fields
        required = ["date", "description", "amount", "category"]
        missing = [f for f in required if f not in tx]
        if missing:
            print(f"Error: Missing required fields: {missing}")
            return

        # Generate ID
        tx["id"] = generate_transaction_id(tx)

        # Skip if already exists
        if self._find_transaction_by_id(tx["id"]):
            print(f"Transaction {tx['id']} already exists.")
            return

        # Set metadata
        tx["created_at"] = get_iso_datetime()
        tx["updated_at"] = get_iso_datetime()
        tx["confidence"] = "manual"
        tx["source"] = tx.get("source", "manual")

        self.transactions_db["transactions"].append(tx)

        # Update merchant knowledge if provided
        if "merchant" in tx:
            self._update_merchant_knowledge(tx["merchant"], tx["category"])

        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)
        save_json(f"{self.knowledge_dir}/merchants.json", self.merchants_db)

        print(f"Added manual transaction {tx['id']}")
        print(f"  {tx['date']} {tx['description']} R$ {tx['amount']}")

    def bulk_categorize(self, merchant: str, category: str) -> None:
        """Update category for all transactions from a merchant."""
        matching_txs = [
            tx for tx in self.transactions_db["transactions"]
            if normalize_text(tx.get("merchant", "")) == normalize_text(merchant)
        ]

        if not matching_txs:
            print(f"No transactions found for merchant: {merchant}")
            return

        for tx in matching_txs:
            tx["category"] = category
            tx["updated_at"] = get_iso_datetime()
            tx["confidence"] = "manual"

        # Update merchant knowledge
        self._update_merchant_knowledge(merchant, category)

        self.transactions_db["last_updated"] = get_iso_datetime()
        save_json(self.db_path, self.transactions_db)
        save_json(f"{self.knowledge_dir}/merchants.json", self.merchants_db)

        print(f"Updated {len(matching_txs)} transactions")
        print(f"  Merchant: {merchant}")
        print(f"  Category: {category}")

    def _update_merchant_knowledge(self, merchant: str, category: str) -> None:
        """Update merchant in the merchants database."""
        normalized = normalize_text(merchant)

        if "merchants" not in self.merchants_db:
            self.merchants_db["merchants"] = {}

        # Check if merchant already exists (by normalized name)
        existing = None
        for key, data in self.merchants_db["merchants"].items():
            if normalize_text(data.get("name", "")) == normalized:
                existing = key
                break

        if existing:
            # Update category if different
            data = self.merchants_db["merchants"][existing]
            if data.get("category") != category:
                data["category"] = category
                # Add variant if it's a new name
                if merchant not in data.get("variants", []):
                    data["variants"].append(merchant)
        else:
            # Create new merchant entry
            self.merchants_db["merchants"][normalized] = {
                "name": merchant,
                "category": category,
                "variants": [merchant],
                "confidence": "learned",
            }

    def _update_pattern_knowledge(self, tx: Dict[str, Any]) -> None:
        """Update patterns database from transaction."""
        pattern_type = tx.get("pattern_type")

        if pattern_type == "recurring":
            # Add to recurring patterns
            pattern = {
                "description_pattern": tx.get("description", ""),
                "category": tx.get("category"),
                "frequency": tx.get("frequency", "monthly"),
                "typical_amount": tx.get("amount"),
                "last_seen": tx.get("date"),
            }
            if "recurring" not in self.patterns_db:
                self.patterns_db["recurring"] = []
            self.patterns_db["recurring"].append(pattern)

        elif pattern_type == "installment":
            # Add to installment groups
            installment = {
                "group_id": tx.get("group_id"),
                "description": tx.get("description", ""),
                "category": tx.get("category"),
                "total_installments": tx.get("total_installments"),
                "current_installment": tx.get("current_installment"),
            }
            if "installments" not in self.patterns_db:
                self.patterns_db["installments"] = []
            self.patterns_db["installments"].append(installment)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Commit transactions to finance database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Common arguments
    parser.add_argument(
        "--db",
        default="TRANSACTIONS.json",
        help="Path to transactions database",
    )
    parser.add_argument(
        "--knowledge",
        default=".",
        help="Path to knowledge base directory",
    )

    # Subcommands
    subparsers = parser.add_subparsers(dest="mode", help="Operation mode")

    # Default mode arguments (only when no subcommand)
    parser.add_argument(
        "--transactions",
        help="Path to categorized transactions file",
    )
    parser.add_argument(
        "--links",
        help="Path to links report file",
    )

    # Edit mode
    edit_parser = subparsers.add_parser("edit", help="Edit a transaction")
    edit_parser.add_argument("--id", required=True, help="Transaction ID")
    edit_parser.add_argument("--field", required=True, help="Field to update")
    edit_parser.add_argument("--value", required=True, help="New value")
    edit_parser.add_argument("--db", help="Path to transactions database")
    edit_parser.add_argument("--knowledge", help="Path to knowledge base directory")

    # Delete mode
    delete_parser = subparsers.add_parser("delete", help="Delete a transaction")
    delete_parser.add_argument("--id", required=True, help="Transaction ID")
    delete_parser.add_argument("--db", help="Path to transactions database")

    # Add mode
    add_parser = subparsers.add_parser("add", help="Add manual transaction")
    add_parser.add_argument(
        "--json",
        required=True,
        help="Transaction JSON",
    )
    add_parser.add_argument("--db", help="Path to transactions database")
    add_parser.add_argument("--knowledge", help="Path to knowledge base directory")

    # Bulk categorize mode
    bulk_parser = subparsers.add_parser(
        "bulk-categorize",
        help="Update category for merchant",
    )
    bulk_parser.add_argument("--merchant", required=True, help="Merchant name")
    bulk_parser.add_argument("--category", required=True, help="New category")
    bulk_parser.add_argument("--db", help="Path to transactions database")
    bulk_parser.add_argument("--knowledge", help="Path to knowledge base directory")

    # Add bidirectional link
    link_parser = subparsers.add_parser(
        "add-link",
        help="Add a bidirectional link between two transactions",
    )
    link_parser.add_argument("--id-a", required=True, help="First transaction ID")
    link_parser.add_argument("--id-b", required=True, help="Second transaction ID")
    link_parser.add_argument("--type", required=True, help="Link type")
    link_parser.add_argument("--note", default="", help="Link note")
    link_parser.add_argument("--confidence", type=float, default=0.95, help="Confidence")
    link_parser.add_argument("--settles", action="store_true", default=True, help="Link settles value (default: True)")
    link_parser.add_argument("--no-settles", dest="settles", action="store_false", help="Link is informational only")
    link_parser.add_argument("--settled-amount", type=float, default=None, help="Amount settled (default: min of both)")
    link_parser.add_argument("--db", help="Path to transactions database")
    link_parser.add_argument("--knowledge", help="Path to knowledge base directory")

    # Repair bidirectional links
    repair_parser = subparsers.add_parser(
        "repair-links",
        help="Ensure all links are bidirectional",
    )
    repair_parser.add_argument("--db", help="Path to transactions database")
    repair_parser.add_argument("--knowledge", help="Path to knowledge base directory")

    args = parser.parse_args()

    # Use provided args or defaults
    db_path = args.db if hasattr(args, 'db') and args.db else "TRANSACTIONS.json"
    knowledge_dir = args.knowledge if hasattr(args, 'knowledge') and args.knowledge else "."

    # Initialize committer
    committer = FinanceCommitter(db_path, knowledge_dir)

    # Route to appropriate handler
    if args.mode == "edit":
        committer.edit_transaction(args.id, args.field, args.value)
    elif args.mode == "delete":
        committer.delete_transaction(args.id)
    elif args.mode == "add":
        committer.add_manual_transaction(args.json)
    elif args.mode == "bulk-categorize":
        committer.bulk_categorize(args.merchant, args.category)
    elif args.mode == "add-link":
        committer.add_bidirectional_link(
            args.id_a, args.id_b, args.type, args.note, args.confidence,
            settles=args.settles, settled_amount=args.settled_amount,
        )
    elif args.mode == "repair-links":
        repairs = committer.repair_bidirectional_links()
        print(f"Repaired {repairs} one-way links (added reverse direction)")
    else:
        # Default mode: commit transactions
        if not args.transactions:
            parser.print_help()
            sys.exit(1)
        committer.commit_transactions(args.transactions, args.links)


if __name__ == "__main__":
    main()
