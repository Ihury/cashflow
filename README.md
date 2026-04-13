# Cashflow

Personal finance tracker powered by Claude Code. Ingest transactions from multiple bank accounts, auto-categorize them, detect relationships (splits, reimbursements, transfers), and visualize everything in an interactive dashboard.

## How it works

1. **Ingest** — Import transactions from any source: bank statements, credit card invoices, benefit extracts, spreadsheets, CSVs, or even plain text
2. **Merge** — Deduplicate across sources using deterministic hashing
3. **Categorize** — AI-powered categorization with a learning knowledge base
4. **Link** — Auto-detect relationships: split bills, reimbursements, self-transfers, debt chains
5. **Visualize** — Interactive React dashboard with KPIs, charts, and filterable tables

## Project structure

```
cashflow/
├── .claude/skills/finance-tracker/   # Claude Code skill (the AI brain)
│   ├── SKILL.md                      # Skill instructions
│   ├── scripts/                      # Python processing pipeline
│   │   ├── ingest.py                 # Parse transaction files (XLS, CSV, etc.)
│   │   ├── merge.py                  # Deduplication & conflict resolution
│   │   ├── categorize.py             # AI-powered categorization
│   │   ├── link_detector.py          # Transaction relationship detection
│   │   ├── commit.py                 # Save to transactions.json
│   │   ├── knowledge.py              # Knowledge base management
│   │   └── utils.py                  # Utilities (hashing, normalization)
│   └── references/
│       ├── schema.md                 # Transaction data schema
│       └── categories.md             # Category taxonomy
├── dashboard/                        # React + TypeScript + Vite
│   └── src/
│       ├── components/               # Charts, tables, KPI cards
│       ├── domain/                   # Pure functions (aggregations, filters)
│       ├── pages/                    # Annual & monthly views
│       └── types/                    # TypeScript interfaces
└── data/                             # Your financial data (gitignored)
    ├── transactions.json             # All transactions
    └── knowledge/                    # Learned patterns
        ├── people.json               # People you transact with
        ├── merchants.json            # Merchant → category mappings
        ├── rules.json                # Categorization rules
        └── patterns.json             # Recurring & debt chain patterns
```

## Getting started

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (or Claude Desktop with Cowork)
- Node.js 18+
- Python 3.10+

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/Ihury/cashflow.git
   cd cashflow
   ```

2. Copy sample data files and customize:
   ```bash
   cp data/transactions.sample.json data/transactions.json
   cp data/knowledge/people.sample.json data/knowledge/people.json
   cp data/knowledge/merchants.sample.json data/knowledge/merchants.json
   cp data/knowledge/rules.sample.json data/knowledge/rules.json
   cp data/knowledge/patterns.sample.json data/knowledge/patterns.json
   ```

3. Install dashboard dependencies:
   ```bash
   cd dashboard
   npm install
   ```

4. Run the dashboard:
   ```bash
   npm run dev
   ```

### Importing transactions

Open Claude Code in the project root and ask it to import your transactions. You can use any file format — Claude will figure out the structure:

```
Import my transactions from the file ~/Downloads/bank-statement.csv
```

```
Import my credit card invoice from ~/Downloads/invoice-april.xls
```

Claude will use the finance-tracker skill to ingest, deduplicate, categorize, and link your transactions automatically. It works with bank exports, finance app spreadsheets, benefit platform CSVs, PDF statements, or any structured transaction data.

## Tech stack

- **Frontend**: React 18, TypeScript, Vite, Recharts, Tailwind CSS 4
- **Scripts**: Python 3 (pandas, xlrd)
- **AI**: Claude Code/Cowork with custom skill for financial reasoning
- **Data**: JSON-based (no database needed)

## Key concepts

**Link types** — Transactions can be linked to each other to represent relationships:
- `split_bill` — Shared expense, someone paid their part
- `reimbursement` — Someone paid you back
- `self_transfer` — Moving money between your own accounts
- `invoice_payment` — Credit card bill payment
- `pass_through` — Money received and forwarded (debt chains)
- `estorno` — Refund/chargeback

**Bruto vs Líquido** — The dashboard supports two viewing modes:
- **Bruto** (gross): All transactions as-is
- **Líquido** (net): Linked transactions are netted out, showing real economic impact

## License

MIT
