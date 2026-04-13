# Transaction Schema

## Estrutura de uma transação no transactions.json

```json
{
  "id": "string (SHA-256 hash)",
  "date": "string (YYYY-MM-DD)",
  "time": "string (HH:MM) ou null",
  "description": "string (descrição original)",
  "description_clean": "string (normalizada: sem acentos, uppercase, sem espaços extras)",
  "amount": "float (negativo = despesa, positivo = receita)",
  "source": "string (flash|conta_btg|conta_itau|conta_nubank|cartao_btg|cartao_itau|cartao_nubank)",
  "account_type": "string (checking|credit_card|benefit)",
  "category": "string ou null",
  "type": "string (expense|income|transfer|invoice_payment|benefit_credit)",
  "counterpart": "string (pessoa/comerciante do outro lado) ou null",
  "status": "string (Pago|Pendente|etc)",
  "invoice_ref": "string (Abril/2026) ou null — só para cartões",
  "installment": {
    "current": "int",
    "total": "int"
  },
  "links": [
    {
      "linked_to": "string (ID da transação vinculada)",
      "type": "string (split_bill|reimbursement|pass_through|self_transfer|test_refund|installment_group|estorno|overpayment_return|loan|loan_repayment|debt_chain)",
      "settles": "boolean (true = este link compensa valor na visão líquida, false = link informativo)",
      "settled_amount": "float >= 0 (quanto do amount DESTA transação é compensado por este link)",
      "note": "string (contexto do vínculo)",
      "confidence": "float (0-1)",
      "confirmed": "boolean"
    }
  ],
  // INVARIANTES:
  // 1. BIDIRECIONAL: se tx A tem link para B, então tx B DEVE ter link para A.
  // 2. CONSISTÊNCIA: para links settles=true, settled_amount deve ser igual nos dois lados do par.
  // 3. LIMITE: sum(settled_amount) de uma transação nunca pode exceder abs(amount).
  // 4. VISÃO LÍQUIDA: net_amount = sign(amount) * (abs(amount) - sum(settled_amount where settles=true))
  //    Se net_amount == 0, a transação é totalmente abatida e não entra na soma líquida.
  //
  // Use commit.py add-link para garantir bidirecionalidade.
  // Use commit.py repair-links para corrigir links unidirecionais existentes.
  "confidence": "string (auto|confirmed|manual)",
  "notes": "string",
  "created_at": "string (ISO datetime)",
  "updated_at": "string (ISO datetime)",
  "original_data": {
    "raw_description": "string",
    "raw_value": "string",
    "raw_category": "string",
    "sheet_name": "string",
    "additional_info": "string"
  }
}
```

## Estrutura do transactions.json

```json
{
  "version": 1,
  "last_updated": "ISO datetime",
  "transactions": [
    { ... }
  ]
}
```

## Estrutura do merge_report.json

```json
{
  "new_transactions": [ ... ],
  "duplicates": [ { "new": {...}, "existing_id": "..." } ],
  "conflicts": [ { "new": {...}, "existing": {...}, "reason": "..." } ],
  "self_transfers": [ { "from": {...}, "to": {...} } ],
  "invoice_payments": [ { "payment": {...}, "invoice_items": [...] } ],
  "stats": {
    "total_ingested": 0,
    "new": 0,
    "duplicates": 0,
    "conflicts": 0
  }
}
```

## Estrutura do links_report.json

```json
{
  "confirmed_links": [
    {
      "transaction_id": "...",
      "linked_to": "...",
      "type": "split_bill",
      "confidence": 0.95,
      "note": "Parceiro(a) pagou metade do jantar"
    }
  ],
  "suggested_links": [
    {
      "transaction_id": "...",
      "linked_to": "...",
      "type": "reimbursement",
      "confidence": 0.6,
      "note": "Valor similar, 3 dias depois"
    }
  ],
  "stats": {
    "auto_linked": 0,
    "needs_review": 0
  }
}
```

## Knowledge Base Schemas

### merchants.json
```json
{
  "merchants": {
    "NORMALIZED_NAME": {
      "category": "string",
      "subcategory": "string ou null",
      "variants": ["Original Name 1", "Original Name 2"],
      "notes": "string",
      "confidence": "float (0-1)",
      "last_seen": "YYYY-MM-DD"
    }
  }
}
```

### people.json
```json
{
  "people": {
    "normalized_name": {
      "full_name": "string",
      "relationship": "string (namorada|roommate|amigo|familia|trabalho|desconhecido)",
      "variants": ["Name 1", "NAME 2", "PIX TRANSF NAME"],
      "typical_patterns": ["split_bill", "reimbursement"],
      "notes": "string"
    }
  }
}
```

### rules.json
```json
{
  "rules": [
    {
      "id": "string",
      "pattern": "string (regex ou substring)",
      "match_field": "description|counterpart|source",
      "action": {
        "set_category": "string",
        "set_type": "string",
        "set_link_type": "string"
      },
      "priority": "int (higher = takes precedence)",
      "notes": "string",
      "created_at": "ISO datetime"
    }
  ]
}
```

### patterns.json
```json
{
  "installment_groups": [
    {
      "description_pattern": "string",
      "total_installments": "int",
      "amount_per_installment": "float",
      "first_seen": "YYYY-MM-DD",
      "transaction_ids": ["..."]
    }
  ],
  "recurring": [
    {
      "description_pattern": "string",
      "frequency": "monthly|weekly",
      "typical_amount": "float",
      "category": "string"
    }
  ],
  "invoice_patterns": [
    {
      "account_source": "string",
      "card_source": "string",
      "payment_description_pattern": "string",
      "typical_day": "int"
    }
  ]
}
```
