#!/usr/bin/env python3
"""
Apply categorization rules to transactions.

This script loads new transactions from a merge report and applies categorization
based on merchant knowledge, rules, and regex patterns. Uncategorized transactions
are marked for manual review.

Usage:
    python categorize.py --transactions MERGE_REPORT.json \\
                        --knowledge KNOWLEDGE_DIR \\
                        --output CATEGORIZED.json

The script reads new_transactions from the merge report and generates categorized.json
with auto_categorized, needs_review lists and stats.
"""

import argparse
import sys
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# Import shared utilities
from utils import (
    load_json,
    save_json,
    normalize_text,
    match_person_name,
)


def load_knowledge_base(knowledge_dir: str) -> Tuple[Dict, Dict, Dict]:
    """
    Load all knowledge base files from directory.

    Args:
        knowledge_dir: Path to knowledge base directory

    Returns:
        Tuple of (merchants_db, rules_db, people_db)
    """
    knowledge_path = Path(knowledge_dir)

    merchants_db = load_json(str(knowledge_path / "merchants.json"))
    rules_db = load_json(str(knowledge_path / "rules.json"))
    people_db = load_json(str(knowledge_path / "people.json"))

    return merchants_db, rules_db, people_db


def find_merchant_match(description: str, merchants_db: Dict) -> Optional[Tuple[str, str]]:
    """
    Check if description matches any merchant in the knowledge base.

    Normalizes the description and checks if any merchant variant is a substring match.

    Args:
        description: Transaction description
        merchants_db: Merchants knowledge base with structure:
            {
                "merchant_key": {
                    "name": "Merchant Name",
                    "category": "category_name",
                    "variants": ["variant1", "variant2", ...]
                },
                ...
            }

    Returns:
        Tuple of (merchant_key, category) if match found, None otherwise
    """
    if not description or not merchants_db:
        return None

    description_normalized = normalize_text(description)

    # Handle both {"merchants": {...}} wrapper and flat dict
    merchants = merchants_db.get("merchants", merchants_db) if isinstance(merchants_db, dict) else {}

    for merchant_key, merchant_data in merchants.items():
        if not isinstance(merchant_data, dict):
            continue
        if "variants" not in merchant_data or "category" not in merchant_data:
            continue

        # Check each variant
        for variant in merchant_data["variants"]:
            variant_normalized = normalize_text(variant)

            # Check if variant is a substring of the description
            if variant_normalized in description_normalized:
                return merchant_key, merchant_data["category"]

    return None


def apply_rules(description: str, rules_db: Dict) -> Optional[str]:
    """
    Apply regex rules to description and return matching category.

    Rules are applied in priority order (as listed in rules.json).

    Args:
        description: Transaction description
        rules_db: Rules knowledge base with structure:
            {
                "rules": [
                    {
                        "name": "rule_name",
                        "pattern": "regex_pattern",
                        "category": "category_name"
                    },
                    ...
                ]
            }

    Returns:
        Category name if rule matches, None otherwise
    """
    if not description or not rules_db:
        return None

    description_normalized = normalize_text(description)
    rules = rules_db.get("rules", [])

    # Sort by priority (higher first)
    sorted_rules = sorted(rules, key=lambda r: r.get("priority", 0), reverse=True)

    for rule in sorted_rules:
        pattern = rule.get("pattern")
        if not pattern:
            continue

        # Get category from either flat "category" or nested "action.set_category"
        category = rule.get("category")
        if not category:
            action = rule.get("action", {})
            category = action.get("set_category")
        if not category:
            continue

        try:
            pattern_normalized = normalize_text(pattern)
            # Try substring match first, then regex
            if pattern_normalized in description_normalized:
                return category
            if re.search(pattern_normalized, description_normalized):
                return category
        except re.error:
            continue

    return None


def suggest_income_category(description: str, people_db: Dict) -> Optional[Tuple[str, str]]:
    """
    Suggest category for income transactions based on known people.

    For income transactions from known people, returns their typical pattern category.

    Args:
        description: Transaction description
        people_db: People knowledge base with structure:
            {
                "person_key": {
                    "name": "Full Name",
                    "variants": ["variant1", "variant2", ...],
                    "typical_pattern_category": "category_name"
                },
                ...
            }

    Returns:
        Tuple of (person_key, category) if match found, None otherwise
    """
    if not description or not people_db:
        return None

    # Try to match the description to a person name
    person_key = match_person_name(description, people_db)
    people = people_db.get("people", people_db) if isinstance(people_db, dict) else {}

    if person_key and person_key in people:
        person_data = people[person_key]
        # Map typical_patterns to suggested categories
        patterns = person_data.get("typical_patterns", [])
        if "split_bill" in patterns:
            return person_key, "Divisão de conta"
        elif "reimbursement" in patterns:
            return person_key, "Reembolso"
        elif "self_transfer" in patterns:
            return person_key, None  # Self transfers don't need a spending category

    return None


def categorize_transaction(
    transaction: Dict[str, Any],
    merchants_db: Dict,
    rules_db: Dict,
    people_db: Dict,
) -> Tuple[Dict[str, Any], bool, Optional[str], str]:
    """
    Apply categorization rules to a single transaction.

    Logic:
    1. If already has category from source AND it's in merchants.json → keep it, mark "auto"
    2. If merchant is in merchants.json → apply that category
    3. If description matches a rule in rules.json → apply that category
    4. If income transaction from known person → suggest that category, mark for review
    5. Otherwise → mark for review with no suggestion

    Args:
        transaction: Transaction dict with at minimum: description, type (or amount sign)
        merchants_db: Merchants knowledge base
        rules_db: Rules knowledge base
        people_db: People knowledge base

    Returns:
        Tuple of:
        - Updated transaction dict
        - is_auto_categorized (bool): whether this was auto-categorized
        - suggested_category (str or None): suggested category for review items
        - suggestion_reason (str): "merchant match"|"rule match"|"person match"|"unknown"
    """
    description = transaction.get("description", "")
    existing_category = transaction.get("category")
    amount = transaction.get("amount", 0)
    transaction_type = transaction.get("type", "expense").lower()

    # Determine if transaction is income (positive amount or type=income)
    is_income = (
        transaction_type == "income"
        or (isinstance(amount, (int, float)) and amount > 0)
    )

    # Case 1: Already has category from source → keep it and try to confirm with merchant DB
    if existing_category:
        merchant_match = find_merchant_match(description, merchants_db)
        if merchant_match:
            merchant_key, category = merchant_match
            transaction["category"] = category
            transaction["confidence"] = "auto"
            return transaction, True, None, "merchant match"
        # Even without merchant match, keep the original category from source
        transaction["confidence"] = "auto"
        return transaction, True, None, "kept original"

    # Case 2: Check merchants.json for match
    merchant_match = find_merchant_match(description, merchants_db)
    if merchant_match:
        merchant_key, category = merchant_match
        transaction["category"] = category
        transaction["confidence"] = "auto"
        return transaction, True, None, "merchant match"

    # Case 3: Check rules.json for match
    rule_match = apply_rules(description, rules_db)
    if rule_match:
        transaction["category"] = rule_match
        transaction["confidence"] = "auto"
        return transaction, True, None, "rule match"

    # Case 4: Income transaction from known person
    if is_income:
        person_match = suggest_income_category(description, people_db)
        if person_match:
            person_key, suggested_category = person_match
            return (
                transaction,
                False,
                suggested_category,
                f"similar to {person_key}",
            )

    # Case 5: No categorization found
    return transaction, False, None, "unknown"


def categorize_transactions(
    merge_report: Dict[str, Any],
    merchants_db: Dict,
    rules_db: Dict,
    people_db: Dict,
) -> Dict[str, Any]:
    """
    Categorize all new transactions from merge report.

    Args:
        merge_report: Merge report with "new_transactions" list
        merchants_db: Merchants knowledge base
        rules_db: Rules knowledge base
        people_db: People knowledge base

    Returns:
        Categorized output dict with auto_categorized, needs_review, and stats
    """
    auto_categorized = []
    needs_review = []
    kept_original = 0

    new_transactions = merge_report.get("new_transactions", [])

    for transaction in new_transactions:
        updated_tx, is_auto, suggested_cat, reason = categorize_transaction(
            transaction.copy(),
            merchants_db,
            rules_db,
            people_db,
        )

        if is_auto:
            # Check if we kept the original category
            if transaction.get("category") == updated_tx.get("category"):
                kept_original += 1
            auto_categorized.append(updated_tx)
        else:
            # Add suggestion fields for review items
            updated_tx["suggested_category"] = suggested_cat
            updated_tx["suggestion_reason"] = reason
            needs_review.append(updated_tx)

    # Build output
    stats = {
        "total": len(new_transactions),
        "auto_categorized": len(auto_categorized),
        "needs_review": len(needs_review),
        "kept_original": kept_original,
    }

    return {
        "auto_categorized": auto_categorized,
        "needs_review": needs_review,
        "stats": stats,
    }


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Apply categorization rules to transactions"
    )
    parser.add_argument(
        "--transactions",
        required=True,
        help="Path to merge report JSON file",
    )
    parser.add_argument(
        "--knowledge",
        required=True,
        help="Path to knowledge base directory",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to output categorized.json file",
    )

    args = parser.parse_args()

    # Load inputs
    try:
        merge_report = load_json(args.transactions)
        if not merge_report:
            print(f"Error: Could not load merge report from {args.transactions}", file=sys.stderr)
            sys.exit(1)

        merchants_db, rules_db, people_db = load_knowledge_base(args.knowledge)

        # Categorize transactions
        result = categorize_transactions(merge_report, merchants_db, rules_db, people_db)

        # Save output
        save_json(args.output, result)

        # Print summary
        stats = result["stats"]
        print(f"Categorization complete:")
        print(f"  Total transactions: {stats['total']}")
        print(f"  Auto-categorized: {stats['auto_categorized']}")
        print(f"  Needs review: {stats['needs_review']}")
        print(f"  Kept original category: {stats['kept_original']}")
        print(f"  Output saved to: {args.output}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
