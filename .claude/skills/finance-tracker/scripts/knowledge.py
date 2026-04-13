#!/usr/bin/env python3
"""
Finance Tracker - Knowledge Base Manager

Manages the knowledge base files for the finance tracker.

Actions:
  add_merchant:      Add or update a merchant
  add_rule:          Add a categorization rule
  add_person:        Add a person profile
  add_pattern:       Add a recurring or installment pattern
  list:              List knowledge base summary
  export:            Export full knowledge base as JSON
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Import utils from same directory
from utils import (
    load_json,
    save_json,
    normalize_text,
    get_iso_datetime,
)


class KnowledgeBase:
    """Manage the knowledge base for finance tracking."""

    def __init__(self, knowledge_dir: str):
        self.knowledge_dir = knowledge_dir
        Path(knowledge_dir).mkdir(parents=True, exist_ok=True)

        self.merchants = self._load_or_init("merchants.json", self._init_merchants)
        self.rules = self._load_or_init("rules.json", self._init_rules)
        self.people = self._load_or_init("people.json", self._init_people)
        self.patterns = self._load_or_init("patterns.json", self._init_patterns)

    def _load_or_init(
        self,
        filename: str,
        init_func,
    ) -> Dict[str, Any]:
        """Load file or initialize if not found."""
        filepath = f"{self.knowledge_dir}/{filename}"
        data = load_json(filepath)
        if not data:
            data = init_func()
            save_json(filepath, data)
        return data

    def _init_merchants(self) -> Dict[str, Any]:
        """Initialize merchants database."""
        return {
            "version": 1,
            "last_updated": get_iso_datetime(),
            "merchants": {},
        }

    def _init_rules(self) -> Dict[str, Any]:
        """Initialize rules database."""
        return {
            "version": 1,
            "last_updated": get_iso_datetime(),
            "rules": [],
        }

    def _init_people(self) -> Dict[str, Any]:
        """Initialize people database."""
        return {
            "version": 1,
            "last_updated": get_iso_datetime(),
            "people": {},
        }

    def _init_patterns(self) -> Dict[str, Any]:
        """Initialize patterns database."""
        return {
            "version": 1,
            "last_updated": get_iso_datetime(),
            "recurring": [],
            "installments": [],
        }

    def add_merchant(self, data: Dict[str, Any]) -> None:
        """Add or update a merchant."""
        required = ["name", "category"]
        missing = [f for f in required if f not in data]
        if missing:
            print(f"Error: Missing required fields for merchant: {missing}")
            return

        name = data["name"]
        normalized = normalize_text(name)
        variants = data.get("variants", [name])
        if name not in variants:
            variants.append(name)

        if "merchants" not in self.merchants:
            self.merchants["merchants"] = {}

        # Check for existing merchant by normalized name
        existing_key = None
        for key, merchant_data in self.merchants["merchants"].items():
            if normalize_text(merchant_data.get("name", "")) == normalized:
                existing_key = key
                break

        if existing_key:
            # Update existing
            self.merchants["merchants"][existing_key].update({
                "name": name,
                "category": data["category"],
                "variants": list(set(
                    self.merchants["merchants"][existing_key].get("variants", [])
                    + variants
                )),
                "updated_at": get_iso_datetime(),
            })
            print(f"Updated merchant: {name}")
        else:
            # Create new
            self.merchants["merchants"][normalized] = {
                "name": name,
                "category": data["category"],
                "variants": variants,
                "confidence": data.get("confidence", "manual"),
                "created_at": get_iso_datetime(),
                "updated_at": get_iso_datetime(),
            }
            print(f"Added merchant: {name}")

        self.merchants["last_updated"] = get_iso_datetime()
        save_json(f"{self.knowledge_dir}/merchants.json", self.merchants)

    def add_rule(self, data: Dict[str, Any]) -> None:
        """Add a categorization rule."""
        required = ["pattern", "match_field", "action"]
        missing = [f for f in required if f not in data]
        if missing:
            print(f"Error: Missing required fields for rule: {missing}")
            return

        rule = {
            "pattern": data["pattern"],
            "match_field": data["match_field"],
            "action": data["action"],
            "priority": data.get("priority", 10),
            "created_at": get_iso_datetime(),
        }

        if "rules" not in self.rules:
            self.rules["rules"] = []

        self.rules["rules"].append(rule)
        # Sort by priority (highest first)
        self.rules["rules"].sort(
            key=lambda r: r.get("priority", 0),
            reverse=True,
        )

        self.rules["last_updated"] = get_iso_datetime()
        save_json(f"{self.knowledge_dir}/rules.json", self.rules)

        print(f"Added rule: {data['pattern']} -> {data['action']}")

    def add_person(self, data: Dict[str, Any]) -> None:
        """Add a person profile."""
        required = ["name"]
        missing = [f for f in required if f not in data]
        if missing:
            print(f"Error: Missing required fields for person: {missing}")
            return

        name = data["name"]
        normalized = normalize_text(name)
        variants = data.get("variants", [name])
        if name not in variants:
            variants.append(name)

        if "people" not in self.people:
            self.people["people"] = {}

        # Check for existing person by normalized name
        existing_key = None
        for key, person_data in self.people["people"].items():
            if normalize_text(person_data.get("name", "")) == normalized:
                existing_key = key
                break

        if existing_key:
            # Update existing
            self.people["people"][existing_key].update({
                "name": name,
                "full_name": data.get("full_name", name),
                "relationship": data.get("relationship"),
                "variants": list(set(
                    self.people["people"][existing_key].get("variants", [])
                    + variants
                )),
                "typical_patterns": data.get("typical_patterns", []),
                "updated_at": get_iso_datetime(),
            })
            print(f"Updated person: {name}")
        else:
            # Create new
            self.people["people"][normalized] = {
                "name": name,
                "full_name": data.get("full_name", name),
                "relationship": data.get("relationship"),
                "variants": variants,
                "typical_patterns": data.get("typical_patterns", []),
                "created_at": get_iso_datetime(),
                "updated_at": get_iso_datetime(),
            }
            print(f"Added person: {name}")

        self.people["last_updated"] = get_iso_datetime()
        save_json(f"{self.knowledge_dir}/people.json", self.people)

    def add_pattern(self, data: Dict[str, Any]) -> None:
        """Add a recurring or installment pattern."""
        pattern_type = data.get("type")
        if not pattern_type:
            print("Error: Missing 'type' field (must be 'recurring' or 'installment')")
            return

        required = ["description_pattern", "category"]
        missing = [f for f in required if f not in data]
        if missing:
            print(f"Error: Missing required fields for pattern: {missing}")
            return

        pattern = {
            "type": pattern_type,
            "description_pattern": data["description_pattern"],
            "category": data["category"],
            "frequency": data.get("frequency"),
            "typical_amount": data.get("typical_amount"),
            "created_at": get_iso_datetime(),
        }

        if pattern_type == "recurring":
            if "recurring" not in self.patterns:
                self.patterns["recurring"] = []
            self.patterns["recurring"].append(pattern)
            print(f"Added recurring pattern: {data['description_pattern']}")

        elif pattern_type == "installment":
            if "installments" not in self.patterns:
                self.patterns["installments"] = []
            self.patterns["installments"].append(pattern)
            print(f"Added installment pattern: {data['description_pattern']}")

        else:
            print(f"Error: Unknown pattern type '{pattern_type}'")
            return

        self.patterns["last_updated"] = get_iso_datetime()
        save_json(f"{self.knowledge_dir}/patterns.json", self.patterns)

    def list_knowledge(self) -> None:
        """Print a summary of the knowledge base."""
        print("\n" + "=" * 60)
        print("KNOWLEDGE BASE SUMMARY")
        print("=" * 60)

        # Merchants
        merchants = self.merchants.get("merchants", {})
        print(f"\nMerchants: {len(merchants)}")
        for key, merchant in list(merchants.items())[:5]:
            print(f"  - {merchant['name']} ({merchant['category']})")
        if len(merchants) > 5:
            print(f"  ... and {len(merchants) - 5} more")

        # Rules
        rules = self.rules.get("rules", [])
        print(f"\nCategorization Rules: {len(rules)}")
        for rule in rules[:5]:
            action_str = json.dumps(rule.get("action"))
            print(f"  - {rule['pattern']} -> {action_str}")
        if len(rules) > 5:
            print(f"  ... and {len(rules) - 5} more")

        # People
        people = self.people.get("people", {})
        print(f"\nPeople: {len(people)}")
        for key, person in list(people.items())[:5]:
            rel = person.get("relationship", "unknown")
            print(f"  - {person['name']} ({rel})")
        if len(people) > 5:
            print(f"  ... and {len(people) - 5} more")

        # Patterns
        recurring = self.patterns.get("recurring", [])
        installments = self.patterns.get("installments", [])
        print(f"\nPatterns:")
        print(f"  Recurring: {len(recurring)}")
        print(f"  Installments: {len(installments)}")

        print("\n" + "=" * 60)

    def export_knowledge(self) -> str:
        """Export full knowledge base as JSON string."""
        full_kb = {
            "exported_at": get_iso_datetime(),
            "merchants": self.merchants,
            "rules": self.rules,
            "people": self.people,
            "patterns": self.patterns,
        }
        return json.dumps(full_kb, indent=2, ensure_ascii=False)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Manage finance tracker knowledge base"
    )

    parser.add_argument(
        "--action",
        required=True,
        choices=["add_merchant", "add_rule", "add_person", "add_pattern", "list", "export"],
        help="Action to perform",
    )
    parser.add_argument(
        "--knowledge",
        default=".",
        help="Path to knowledge base directory",
    )
    parser.add_argument(
        "--data",
        help="JSON data for the action",
    )

    args = parser.parse_args()

    # Initialize knowledge base
    kb = KnowledgeBase(args.knowledge)

    # Route to appropriate handler
    if args.action == "list":
        kb.list_knowledge()

    elif args.action == "export":
        print(kb.export_knowledge())

    else:
        # Actions that require data
        if not args.data:
            print(f"Error: --data required for action '{args.action}'")
            sys.exit(1)

        try:
            data = json.loads(args.data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in --data: {e}")
            sys.exit(1)

        if args.action == "add_merchant":
            kb.add_merchant(data)
        elif args.action == "add_rule":
            kb.add_rule(data)
        elif args.action == "add_person":
            kb.add_person(data)
        elif args.action == "add_pattern":
            kb.add_pattern(data)


if __name__ == "__main__":
    main()
