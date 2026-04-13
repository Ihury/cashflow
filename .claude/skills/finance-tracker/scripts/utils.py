"""
Utility functions for finance tracker scripts.
"""

import hashlib
import json
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def load_json(filepath: str) -> Dict[str, Any]:
    """Load JSON file, return empty dict if not found."""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load {filepath}: {e}")
    return {}


def save_json(filepath: str, data: Dict[str, Any]) -> None:
    """Save data to JSON file with proper formatting."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_text(text: str) -> str:
    """
    Normalize text for comparison.
    - lowercase
    - remove accents
    - remove extra whitespace
    - remove special characters except spaces
    """
    if not text:
        return ""

    # Convert to lowercase
    text = text.lower().strip()

    # Remove common prefixes
    for prefix in ["pix ", "ted ", "doc ", "transf ", "compra "]:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

    return text


def generate_transaction_id(transaction: Dict[str, Any]) -> str:
    """
    Generate a unique ID from transaction date and description.
    Format: YYYYMMDD_HASH where HASH is first 8 chars of MD5(description+amount)
    """
    import hashlib

    date_str = transaction.get('date', '').replace('-', '')[:8]

    # Hash description + amount for uniqueness
    hash_input = f"{transaction.get('description', '')}{transaction.get('amount', '')}".encode()
    hash_val = hashlib.md5(hash_input).hexdigest()[:8].upper()

    return f"{date_str}_{hash_val}"


def get_iso_datetime() -> str:
    """Get current datetime in ISO format."""
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


def print_transaction_summary(transactions: List[Dict[str, Any]]) -> None:
    """Print a summary of transactions."""
    if not transactions:
        print("No transactions to display.")
        return

    total = sum(t.get('amount', 0) for t in transactions)
    income = sum(t.get('amount', 0) for t in transactions if t.get('amount', 0) > 0)
    expenses = sum(t.get('amount', 0) for t in transactions if t.get('amount', 0) < 0)

    print(f"\nTransaction Summary:")
    print(f"  Count: {len(transactions)}")
    print(f"  Income: R$ {income:,.2f}")
    print(f"  Expenses: R$ {expenses:,.2f}")
    print(f"  Net: R$ {total:,.2f}")


def normalize_text_uppercase(text: str) -> str:
    """
    Normalize text: remove accents, convert to uppercase, strip whitespace.

    Args:
        text: Input text string

    Returns:
        Normalized text (uppercase, no accents)
    """
    if not text:
        return ""

    # Remove accents
    nfd = unicodedata.normalize('NFD', text)
    without_accents = ''.join(char for char in nfd if unicodedata.category(char) != 'Mn')

    # Uppercase and strip
    return without_accents.upper().strip()


def parse_date(date_str: str, date_format: str = None) -> Optional[str]:
    """
    Parse date string and return ISO format (YYYY-MM-DD).

    Args:
        date_str: Date string to parse
        date_format: Format hint - 'DD.MM.YYYY' or 'DD/MM/YYYY'

    Returns:
        Date in YYYY-MM-DD format or None if parsing fails
    """
    if not date_str or not isinstance(date_str, str):
        return None

    date_str = date_str.strip()

    # Try common formats
    formats = [
        '%d.%m.%Y',    # DD.MM.YYYY
        '%d/%m/%Y',    # DD/MM/YYYY
        '%Y-%m-%d',    # YYYY-MM-DD
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """
    Parse time string and return HH:MM format.

    Args:
        time_str: Time string to parse

    Returns:
        Time in HH:MM format or None if parsing fails
    """
    if not time_str or not isinstance(time_str, str):
        return None

    time_str = time_str.strip()

    formats = [
        '%H:%M:%S',
        '%H:%M',
        '%H%M%S',
        '%H%M',
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt.strftime('%H:%M')
        except ValueError:
            continue

    return None


def parse_brazilian_currency(value_str: str) -> Optional[float]:
    """
    Parse Brazilian currency format: "R$ 1.234,56" or "-R$ 1.234,56".
    Also handles plain floats.

    Args:
        value_str: Value string to parse

    Returns:
        Float value or None if parsing fails
    """
    if value_str is None:
        return None

    # Handle numeric types
    if isinstance(value_str, (int, float)):
        return float(value_str)

    if not isinstance(value_str, str):
        return None

    value_str = value_str.strip()

    # Check for negative sign
    is_negative = False
    if value_str.startswith('-'):
        is_negative = True
        value_str = value_str[1:].strip()

    # Remove R$ prefix and whitespace
    value_str = value_str.replace('R$', '').strip()

    # Brazilian format: 1.234,56 -> remove dots, replace comma with dot
    value_str = value_str.replace('.', '').replace(',', '.')

    try:
        value = float(value_str)
        if is_negative:
            value = -value
        return value
    except ValueError:
        return None


def generate_transaction_id_from_parts(source_sheet: str, date: str, description: str,
                                       amount: float, occurrence_index: int = 0) -> str:
    """
    Generate unique transaction ID for Organizze transactions.

    Args:
        source_sheet: Sheet name (e.g., 'Conta Itaú')
        date: Transaction date (YYYY-MM-DD)
        description: Transaction description
        amount: Transaction amount
        occurrence_index: Index for duplicate transactions (0, 1, 2...)

    Returns:
        SHA256 hash of combined data
    """
    data = f"{source_sheet}:{date}:{description}:{amount}:{occurrence_index}"
    return hashlib.sha256(data.encode()).hexdigest()


def generate_transaction_id_flash(date: str, time: str, description: str,
                                 amount: float) -> str:
    """
    Generate unique transaction ID for Flash CSV transactions.

    Args:
        date: Transaction date (YYYY-MM-DD)
        time: Transaction time (HH:MM or null)
        description: Transaction description
        amount: Transaction amount

    Returns:
        SHA256 hash of combined data
    """
    time_part = time if time else "null"
    data = f"{date}:{time_part}:{description}:{amount}"
    return hashlib.sha256(data.encode()).hexdigest()


def detect_installment(description: str) -> Optional[Dict[str, int]]:
    """
    Detect installment information from description.
    Patterns: "X/Y" or "Parcelado em X de Y"

    Args:
        description: Transaction description

    Returns:
        Dict with 'current' and 'total' keys or None
    """
    if not description:
        return None

    # Pattern: "X/Y" (e.g., "1/10")
    match = re.search(r'(\d+)/(\d+)', description)
    if match:
        current = int(match.group(1))
        total = int(match.group(2))
        if 1 <= current <= total:
            return {"current": current, "total": total}

    return None


def extract_counterpart(description: str) -> Optional[str]:
    """
    Extract counterpart name from description.
    Patterns: "TED BANCO - NOME COMPLETO", "Pix para NOME", etc.

    Args:
        description: Transaction description

    Returns:
        Extracted counterpart name or None
    """
    if not description:
        return None

    # Common patterns
    patterns = [
        r'(?:TED|DOC|PIX|Transferência)\s*-?\s*([A-Z\s]+?)(?:\s*$|\s*-\s*|\s*CNPJ|\s*CPF)',
        r'(?:para|de|do|da)\s+([A-Z][A-Z\s]+?)(?:\s*$|\s*CPF|\s*CNPJ)',
        r'^([A-Z][A-Z\s]+?)\s*(?:TED|DOC|PIX)',
    ]

    for pattern in patterns:
        match = re.search(pattern, description)
        if match:
            counterpart = match.group(1).strip()
            # Filter out common non-names
            if counterpart and len(counterpart) > 2 and counterpart not in ['NULL', 'NONE']:
                return counterpart[:100]  # Limit length

    return None


def normalize_source_name(source_str: str) -> str:
    """
    Normalize source sheet name to consistent format.

    Customize these mappings for your bank accounts:
    - Replace 'conta_banco_a', 'conta_banco_b', etc. with your actual bank account names
    - Replace 'cartao_banco_a', 'cartao_banco_b', etc. with your actual credit card names

    Args:
        source_str: Source name from sheet

    Returns:
        Normalized source identifier
    """
    if not source_str:
        return "unknown"

    source_lower = source_str.strip().lower()

    mapping = {
        'conta banco a': 'conta_banco_a',
        'conta banco b': 'conta_banco_b',
        'conta banco c': 'conta_banco_c',
        'cartao banco a': 'cartao_banco_a',
        'cartao banco b': 'cartao_banco_b',
        'cartao banco c': 'cartao_banco_c',
        'flash': 'flash',
    }

    return mapping.get(source_lower, source_lower.replace(' ', '_'))


def get_account_type(source_str: str) -> str:
    """
    Determine account type from source.

    Args:
        source_str: Normalized source identifier

    Returns:
        'checking', 'credit_card', or 'benefit'
    """
    if 'cartao' in source_str.lower() or 'cartão' in source_str.lower():
        return 'credit_card'
    elif 'flash' in source_str.lower():
        return 'benefit'
    else:
        return 'checking'


def is_invoice_payment_description(description: str) -> bool:
    """
    Check if description matches invoice payment patterns.

    Args:
        description: Transaction description

    Returns:
        True if matches invoice payment pattern
    """
    if not description:
        return False

    desc_upper = description.upper()

    patterns = [
        'FATURA PAGA',
        'PAGAMENTO DE FATURA',
        'FATURA',
        'PAG FATURA',
    ]

    for pattern in patterns:
        if pattern in desc_upper:
            return True

    return False


def is_self_transfer_description(description: str, counterpart: str = None, people_db: Dict = None) -> bool:
    """
    Check if description matches self-transfer pattern by comparing against the "self" person in people.json.

    Configure your name in people.json under the "self" entry for accurate matching.

    Args:
        description: Transaction description
        counterpart: Extracted counterpart name
        people_db: People knowledge base dict with 'people' key

    Returns:
        True if matches self-transfer pattern
    """
    # Try to match against the "self" person in the people database
    if people_db:
        self_person = people_db.get("people", {}).get("self", {})
        self_variants = self_person.get("variants", [])
        self_full_name = self_person.get("full_name", "")

        if counterpart:
            counterpart_clean = normalize_text_uppercase(counterpart)
            if self_full_name:
                if counterpart_clean in normalize_text_uppercase(self_full_name):
                    return True
            for variant in self_variants:
                if counterpart_clean in normalize_text_uppercase(variant):
                    return True

        if description:
            desc_clean = normalize_text_uppercase(description)
            if self_full_name:
                if normalize_text_uppercase(self_full_name) in desc_clean:
                    return True
            for variant in self_variants:
                if normalize_text_uppercase(variant) in desc_clean:
                    return True

    return False


def match_person_name(name: str, people_db: Dict) -> Optional[str]:
    """
    Match a name against the people knowledge base using variant matching.

    Args:
        name: Name to match (from transaction description/counterpart)
        people_db: People knowledge base dict with 'people' key

    Returns:
        Person key (e.g., 'ana_julia') or None
    """
    if not name or not people_db:
        return None

    people = people_db.get("people", {})
    name_clean = normalize_text(name).upper().strip()

    if not name_clean:
        return None

    for person_key, person_data in people.items():
        variants = person_data.get("variants", [])
        full_name = person_data.get("full_name", "")

        # Check full name
        if full_name:
            full_clean = normalize_text(full_name).upper().strip()
            if full_clean and (full_clean in name_clean or name_clean in full_clean):
                return person_key

        # Check variants
        for variant in variants:
            variant_clean = normalize_text(variant).upper().strip()
            if variant_clean and (variant_clean in name_clean or name_clean in variant_clean):
                return person_key

    return None


def is_benefit_credit_description(description: str) -> bool:
    """
    Check if description matches benefit credit patterns.

    Args:
        description: Transaction description

    Returns:
        True if matches benefit credit pattern
    """
    if not description:
        return False

    desc_upper = description.upper()

    patterns = [
        'DEPÓSITO TRANSFERIDO',
        'CREDITO BENEFICIO',
        'CRÉDITO BENEFÍCIO',
        'DEPOSITO BENEFICIO',
    ]

    for pattern in patterns:
        if pattern in desc_upper:
            return True

    return False


def is_pj_income_description(description: str, people_db: Dict = None) -> bool:
    """
    Check if description matches PJ (pessoa jurídica) income transfer pattern.
    These contain CNPJ-like prefixes (XX.XXX.XXX format) before a matching person's name.

    Configure your CNPJ in people.json under the "self" entry's variants for accurate matching.

    Args:
        description: Transaction description
        people_db: People knowledge base dict with 'people' key

    Returns:
        True if matches PJ income pattern
    """
    if not description:
        return False

    # Generic pattern: CNPJ prefix (XX.XXX.XXX) followed by any name
    # Users should configure their CNPJ in people.json for more accurate matching
    if re.search(r'\d{2}\.\d{3}\.\d{3}\s+[A-Z]', description, re.IGNORECASE):
        # If people_db provided, verify it matches the "self" person
        if people_db:
            self_person = people_db.get("people", {}).get("self", {})
            self_variants = self_person.get("variants", [])
            self_full_name = self_person.get("full_name", "")

            desc_clean = normalize_text_uppercase(description)

            if self_full_name:
                if normalize_text_uppercase(self_full_name) in desc_clean:
                    return True
            for variant in self_variants:
                if normalize_text_uppercase(variant) in desc_clean:
                    return True
            return False

        # If no people_db, accept any CNPJ pattern
        return True

    return False
