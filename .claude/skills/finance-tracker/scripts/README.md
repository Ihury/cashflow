# Personal Finance Tracker Scripts

Two comprehensive Python scripts for managing personal finance transactions and building intelligent categorization knowledge bases.

## Scripts Overview

### 1. commit.py - Transaction Commit Manager
Handles all transaction database operations including adding, editing, deleting, and bulk categorizing transactions.

**Key Features:**
- Default mode: Batch commit categorized transactions with link relationships
- Edit mode: Update individual transaction fields
- Delete mode: Remove transactions and their references
- Add mode: Manually insert single transactions
- Bulk-categorize mode: Update all transactions from a merchant at once

**Database Format:**
```json
{
  "version": 1,
  "last_updated": "ISO datetime",
  "transactions": [
    {
      "id": "YYYYMMDD_HASH",
      "date": "2026-01-15",
      "description": "Transaction description",
      "amount": -50.00,
      "category": "Alimentacao",
      "merchant": "Optional merchant name",
      "created_at": "ISO datetime",
      "updated_at": "ISO datetime",
      "confidence": "auto|manual",
      "links": []
    }
  ]
}
```

### 2. knowledge.py - Knowledge Base Manager
Manages merchant mappings, categorization rules, people profiles, and transaction patterns.

**Key Features:**
- add_merchant: Create/update merchant→category mappings with variants
- add_rule: Define pattern-based categorization rules with priorities
- add_person: Build profiles for people involved in transactions
- add_pattern: Track recurring and installment payment patterns
- list: Display knowledge base summary
- export: Full backup export as JSON

**Knowledge Base Files:**
- `merchants.json`: Merchant names, categories, variants
- `rules.json`: Pattern-based categorization rules
- `people.json`: Person profiles with relationships
- `patterns.json`: Recurring and installment patterns

### 3. utils.py - Utility Module
Common functions used by both scripts:
- `load_json()`: Safe JSON file loading
- `save_json()`: JSON file writing with formatting
- `normalize_text()`: Text normalization for fuzzy matching
- `generate_transaction_id()`: ID generation from date + hash
- `get_iso_datetime()`: ISO format timestamps
- `print_transaction_summary()`: Statistics display

## Usage Examples

### Initialize Knowledge Base
```bash
python knowledge.py --action add_merchant --knowledge ./kb \
  --data '{"name":"STARBUCKS","category":"Alimentacao"}'
```

### Commit Batch of Transactions
```bash
python commit.py --transactions categorized.json \
  --db transactions.json --knowledge ./kb
```

### Fix Miscategorized Transaction
```bash
python commit.py edit --id 20260115_ABC123 \
  --field category --value "Restaurantes" \
  --db transactions.json --knowledge ./kb
```

### Add Recurring Pattern
```bash
python knowledge.py --action add_pattern --knowledge ./kb \
  --data '{"type":"recurring","description_pattern":"Netflix","frequency":"monthly","category":"Entretenimento"}'
```

### Bulk Categorize by Merchant
```bash
python commit.py bulk-categorize --merchant "STARBUCKS" \
  --category "Cafes e Restaurantes" \
  --db transactions.json --knowledge ./kb
```

### View Knowledge Base
```bash
python knowledge.py --action list --knowledge ./kb
```

### Backup Knowledge
```bash
python knowledge.py --action export --knowledge ./kb > backup.json
```

### Manually Add Transaction
```bash
python commit.py add \
  --json '{"date":"2026-03-12","description":"Almoco","amount":-75.50,"category":"Alimentacao"}' \
  --db transactions.json --knowledge ./kb
```

## Error Handling
- Scripts gracefully handle missing files by initializing empty structures
- All database operations are atomic (save only after validation)
- JSON parsing errors are caught and reported clearly
- Duplicate detection prevents transaction duplication

## Design Notes
- Transaction IDs are deterministic (generated from date + description hash)
- Text normalization enables fuzzy merchant matching
- Knowledge base supports confidence scoring for categorizations
- Transaction links track relationships between transactions
- Pattern types (recurring/installment) help predict future transactions

## Requirements
- Python 3.6+
- Standard library only (json, argparse, pathlib, datetime, hashlib, re)
- No external dependencies

## File Locations
- `/sessions/peaceful-gallant-hopper/mnt/pessoal-finance/finance-tracker/scripts/commit.py`
- `/sessions/peaceful-gallant-hopper/mnt/pessoal-finance/finance-tracker/scripts/knowledge.py`
- `/sessions/peaceful-gallant-hopper/mnt/pessoal-finance/finance-tracker/scripts/utils.py`
