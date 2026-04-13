#!/usr/bin/env python3
"""
Initialize the knowledge base with known data for the personal finance tracker.

Usage:
    python init_knowledge.py DATA_DIR

Where DATA_DIR is the path to the data directory (e.g., /path/to/pessoal-finance/data).
"""

import json
import os
import sys
from datetime import datetime


def create_transactions_file(data_dir):
    """Create transactions.json if it doesn't exist."""
    transactions_path = os.path.join(data_dir, "transactions.json")

    if os.path.exists(transactions_path):
        print(f"Already exists: {transactions_path}")
        return

    data = {
        "version": 1,
        "last_updated": "2026-04-12T00:00:00",
        "transactions": []
    }

    with open(transactions_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Created: {transactions_path}")


def create_merchants_file(data_dir):
    """Create knowledge/merchants.json with known merchants."""
    knowledge_dir = os.path.join(data_dir, "knowledge")
    os.makedirs(knowledge_dir, exist_ok=True)

    merchants_path = os.path.join(knowledge_dir, "merchants.json")

    if os.path.exists(merchants_path):
        print(f"Already exists: {merchants_path}")
        return

    data = {
        "merchants": {
            "RESTAURANT CHAIN A": {
                "category": "Alimentação",
                "variants": ["Restaurant Chain A LTDA", "RestaurantA", "RestaurantA*"],
                "confidence": 0.9,
                "last_seen": None
            },
            "FOOD DELIVERY SERVICE": {
                "category": "Alimentação",
                "variants": ["Food Delivery Service", "FDS*Service", "Fds*Food Club"],
                "confidence": 0.9,
                "last_seen": None
            },
            "IMOBILIARIA EXEMPLO": {
                "category": "Casa",
                "variants": ["Imobiliaria Exemplo LTDA"],
                "confidence": 0.95,
                "last_seen": None
            },
            "COMPANHIA ELETRICA": {
                "category": "Casa",
                "variants": ["Companhia Eletrica S.A."],
                "confidence": 0.95,
                "last_seen": None
            },
            "OPERADORA TELECOM": {
                "category": "Casa",
                "variants": ["Operadora Telecom S.A."],
                "confidence": 0.95,
                "last_seen": None
            },
            "CONDOMINIO EDIFICIO": {
                "category": "Casa",
                "variants": ["Condominio do Edificio", "CONDOMINIO DO EDIFICIO"],
                "confidence": 0.95,
                "last_seen": None
            },
            "UBER": {
                "category": "Transporte",
                "variants": ["Uber Uber *Trip", "Uber* Trip", "Dl *Uberrides", "Dl*Uberrides"],
                "confidence": 0.9,
                "last_seen": None
            },
            "INTERCITY BUS": {
                "category": "Transporte",
                "variants": ["BUS SERVICOS*INTERCITY", "Bus Servicos*Intercity"],
                "confidence": 0.9,
                "last_seen": None
            },
            "INSURANCE COMPANY": {
                "category": "Transporte",
                "variants": ["Insurance*Pcl", "Insurance*Pcl4de12", "Insurance*Pcl3de12"],
                "confidence": 0.9,
                "notes": "Seguro auto parcelado",
                "last_seen": None
            },
            "AUTO PARTS STORE": {
                "category": "Transporte",
                "variants": ["Auto Parts Store LTDA", "Auto Parts Store"],
                "confidence": 0.9,
                "last_seen": None
            },
            "GYM MEMBERSHIP": {
                "category": "Saúde",
                "variants": ["Gym Membership"],
                "confidence": 0.95,
                "last_seen": None
            },
            "PHARMACY": {
                "category": "Saúde",
                "variants": ["Pharmacy Store", "Pharm*123"],
                "confidence": 0.9,
                "last_seen": None
            },
            "LANGUAGE SCHOOL": {
                "category": "Educação",
                "variants": ["Language School LTDA"],
                "confidence": 0.95,
                "last_seen": None
            },
            "ONLINE LEARNING": {
                "category": "Educação",
                "variants": ["Online Learning Platform"],
                "confidence": 0.9,
                "last_seen": None
            },
            "AI SUBSCRIPTION": {
                "category": "Assinaturas e serviços",
                "variants": ["AI Service Subscription"],
                "confidence": 0.95,
                "last_seen": None
            },
            "CHAT AI SERVICE": {
                "category": "Assinaturas e serviços",
                "variants": ["Chat Ai Service Subscr"],
                "confidence": 0.95,
                "last_seen": None
            },
            "MOBILE CARRIER": {
                "category": "Assinaturas e serviços",
                "variants": ["Mobile Carrier*Service"],
                "confidence": 0.95,
                "last_seen": None
            },
            "CLOUD SERVICES": {
                "category": "Assinaturas e serviços",
                "variants": ["Cloud Services Brasil LTDA"],
                "confidence": 0.9,
                "last_seen": None
            },
            "FINANCE APP": {
                "category": "Assinaturas e serviços",
                "variants": ["Finance App Service"],
                "confidence": 0.9,
                "last_seen": None
            },
            "HAIRCUT SERVICE": {
                "category": "Cuidados pessoais",
                "variants": ["HAIRCUT SERVICE", "Barber*Haircut"],
                "confidence": 0.9,
                "last_seen": None
            },
            "SPORTS CLUB": {
                "category": "Saúde",
                "variants": ["Sports Club"],
                "confidence": 0.9,
                "notes": "Academia/clube",
                "last_seen": None
            },
            "SUPERMARKET": {
                "category": "Mercado",
                "variants": ["Supermarket Store", "SUPERMARKET", "Supermarket*Pcp"],
                "confidence": 0.9,
                "last_seen": None
            },
            "LOCAL GROCERY": {
                "category": "Mercado",
                "variants": ["LOCAL GROCERY", "Grocery Store"],
                "confidence": 0.9,
                "last_seen": None
            },
            "CONVENIENCE STORE": {
                "category": "Mercado",
                "variants": ["CONVENIENCE LTDA", "Convenience Store"],
                "confidence": 0.9,
                "last_seen": None
            },
            "RESTAURANT CASUAL": {
                "category": "Bares e restaurantes",
                "variants": ["RESTAURANT CASUAL"],
                "confidence": 0.9,
                "last_seen": None
            },
            "MOVIE THEATER": {
                "category": "Lazer e hobbies",
                "variants": ["Movie Theater"],
                "confidence": 0.9,
                "last_seen": None
            },
            "AMUSEMENT PARK": {
                "category": "Lazer e hobbies",
                "variants": ["Amusement Park", "Park Entertainment"],
                "confidence": 0.9,
                "last_seen": None
            },
            "EMPLOYER COMPANY": {
                "category": "Salário",
                "variants": ["Employer Company Tech S.A."],
                "confidence": 0.99,
                "notes": "Empregador",
                "last_seen": None
            },
            "PAYROLL BANK": {
                "category": "Salário",
                "variants": ["Payroll Bank S.A."],
                "confidence": 0.8,
                "notes": "Also used for card payments, check context",
                "last_seen": None
            },
            "MARKETPLACE": {
                "category": "Compras",
                "variants": ["MARKETPLACE*", "Marketplace*", "MARKET*STORE", "MARKET*MARKETPLACE"],
                "confidence": 0.8,
                "notes": "Category depends on what was bought",
                "last_seen": None
            },
            "CHARITABLE ORG": {
                "category": "Presentes e doações",
                "variants": ["Charitable Organization", "Charity*Donation"],
                "confidence": 0.9,
                "notes": "Dízimo/doação",
                "last_seen": None
            },
            "VACATION RENTAL": {
                "category": "Viagem",
                "variants": ["Vacation Rental Service"],
                "confidence": 0.9,
                "last_seen": None
            }
        }
    }

    with open(merchants_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Created: {merchants_path}")


def create_people_file(data_dir):
    """Create knowledge/people.json with known people."""
    knowledge_dir = os.path.join(data_dir, "knowledge")
    os.makedirs(knowledge_dir, exist_ok=True)

    people_path = os.path.join(knowledge_dir, "people.json")

    if os.path.exists(people_path):
        print(f"Already exists: {people_path}")
        return

    data = {
        "people": {
            "partner": {
                "full_name": "Partner Name",
                "relationship": "partner",
                "variants": ["Partner", "PARTNER NAME", "PIX TRANSF PARTNER", "Partner N"],
                "typical_patterns": ["split_bill", "reimbursement"],
                "notes": "Shares expenses (restaurants, groceries). Sometimes reimburses full amount."
            },
            "roommate": {
                "full_name": "Roommate Name",
                "relationship": "roommate",
                "variants": ["Roommate", "ROOMMATE NAME", "ROOMMATE N NAME", "Roommate Name"],
                "typical_patterns": ["reimbursement"],
                "notes": "Roommate. Pays share of household expenses (rent, utilities) monthly."
            },
            "self": {
                "full_name": "Your Full Name",
                "relationship": "self",
                "variants": ["Your Full Name", "YOUR FULL NAME", "Your Name"],
                "typical_patterns": ["self_transfer"],
                "notes": "The user. Transactions with this name are transfers between accounts."
            }
        }
    }

    with open(people_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Created: {people_path}")


def create_rules_file(data_dir):
    """Create knowledge/rules.json with categorization rules."""
    knowledge_dir = os.path.join(data_dir, "knowledge")
    os.makedirs(knowledge_dir, exist_ok=True)

    rules_path = os.path.join(knowledge_dir, "rules.json")

    if os.path.exists(rules_path):
        print(f"Already exists: {rules_path}")
        return

    data = {
        "rules": [
            {
                "id": "r001",
                "pattern": "REND PAGO APLIC AUT MAIS",
                "match_field": "description",
                "action": {"set_category": "Rendimento", "set_type": "income"},
                "priority": 10,
                "notes": "Rendimento automático de aplicação"
            },
            {
                "id": "r002",
                "pattern": "PIX QRS RECEITA FED",
                "match_field": "description",
                "action": {"set_category": "Impostos e Taxas"},
                "priority": 10,
                "notes": "Pagamento de imposto via PIX"
            },
            {
                "id": "r003",
                "pattern": "IOF de compra internacional",
                "match_field": "description",
                "action": {"set_category": "Impostos e Taxas"},
                "priority": 10,
                "notes": "IOF em compras internacionais"
            },
            {
                "id": "r004",
                "pattern": "FATURA PAGA",
                "match_field": "description",
                "action": {"set_type": "invoice_payment"},
                "priority": 20,
                "notes": "Pagamento de fatura de cartão"
            },
            {
                "id": "r005",
                "pattern": "Pagamento de fatura",
                "match_field": "description",
                "action": {"set_type": "invoice_payment"},
                "priority": 20,
                "notes": "Pagamento de fatura Nubank"
            },
            {
                "id": "r006",
                "pattern": "Pagamento de NuPay",
                "match_field": "description",
                "action": {"set_category": "Dívidas e empréstimos"},
                "priority": 10,
                "notes": "Parcela NuPay"
            },
            {
                "id": "r007",
                "pattern": "NU PAGAMENTOS",
                "match_field": "description",
                "action": {"set_category": "Dívidas e empréstimos"},
                "priority": 5,
                "notes": "Pagamento via Nu"
            },
            {
                "id": "r008",
                "pattern": "Depósito transferido",
                "match_field": "description",
                "action": {"set_type": "benefit_credit", "set_category": "Benefício alimentação"},
                "priority": 20,
                "notes": "Crédito Flash benefício"
            },
            {
                "id": "r009",
                "pattern": "Recarga de celular",
                "match_field": "description",
                "action": {"set_category": "Assinaturas e serviços"},
                "priority": 10,
                "notes": "Recarga celular"
            },
            {
                "id": "r010",
                "pattern": "ENTREVIAS CONCESSIONAR",
                "match_field": "description",
                "action": {"set_category": "Transporte"},
                "priority": 10,
                "notes": "Pedágio"
            }
        ]
    }

    with open(rules_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Created: {rules_path}")


def create_patterns_file(data_dir):
    """Create knowledge/patterns.json with recurring and installment patterns."""
    knowledge_dir = os.path.join(data_dir, "knowledge")
    os.makedirs(knowledge_dir, exist_ok=True)

    patterns_path = os.path.join(knowledge_dir, "patterns.json")

    if os.path.exists(patterns_path):
        print(f"Already exists: {patterns_path}")
        return

    data = {
        "installment_groups": [],
        "recurring": [
            {
                "description_pattern": "Imobiliaria Exemplo",
                "frequency": "monthly",
                "typical_amount": -1500.00,
                "category": "Casa",
                "notes": "Aluguel"
            },
            {
                "description_pattern": "Condominio do Edificio",
                "frequency": "monthly",
                "typical_amount": -200.00,
                "category": "Casa",
                "notes": "Condomínio"
            },
            {
                "description_pattern": "Companhia Eletrica",
                "frequency": "monthly",
                "typical_amount": None,
                "category": "Casa",
                "notes": "Conta de luz"
            },
            {
                "description_pattern": "Operadora Telecom",
                "frequency": "monthly",
                "typical_amount": -100.00,
                "category": "Casa",
                "notes": "Internet"
            },
            {
                "description_pattern": "Language School",
                "frequency": "monthly",
                "typical_amount": -250.00,
                "category": "Educação",
                "notes": "Aula de idioma"
            },
            {
                "description_pattern": "Gym Membership",
                "frequency": "monthly",
                "typical_amount": -130.00,
                "category": "Saúde",
                "notes": "Academia"
            },
            {
                "description_pattern": "Chat Ai Service",
                "frequency": "monthly",
                "typical_amount": -100.00,
                "category": "Assinaturas e serviços",
                "notes": "Chat AI subscription"
            },
            {
                "description_pattern": "AI Service Subscription",
                "frequency": "monthly",
                "typical_amount": -110.00,
                "category": "Assinaturas e serviços",
                "notes": "AI service subscription"
            },
            {
                "description_pattern": "Mobile Carrier*Service",
                "frequency": "monthly",
                "typical_amount": -50.00,
                "category": "Assinaturas e serviços",
                "notes": "Celular"
            },
            {
                "description_pattern": "Haircut Service",
                "frequency": "monthly",
                "typical_amount": -50.00,
                "category": "Cuidados pessoais",
                "notes": "Barbeiro"
            }
        ],
        "invoice_patterns": [
            {
                "account_source": "conta_banco_a",
                "card_source": "cartao_banco_a",
                "payment_description_pattern": "FATURA PAGA BANCO",
                "typical_day": None
            },
            {
                "account_source": "conta_banco_b",
                "card_source": "cartao_banco_b",
                "payment_description_pattern": "Pagamento de fatura",
                "typical_day": None
            },
            {
                "account_source": "conta_banco_b",
                "card_source": "cartao_banco_c",
                "payment_description_pattern": "Banco Pagamento S.A.",
                "typical_day": None
            }
        ]
    }

    with open(patterns_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Created: {patterns_path}")


def main():
    """Main function to initialize all knowledge base files."""
    if len(sys.argv) != 2:
        print("Usage: python init_knowledge.py DATA_DIR")
        sys.exit(1)

    data_dir = sys.argv[1]

    # Create data directory if it doesn't exist
    os.makedirs(data_dir, exist_ok=True)

    print(f"Initializing knowledge base in: {data_dir}")
    print()

    # Create all files
    create_transactions_file(data_dir)
    create_merchants_file(data_dir)
    create_people_file(data_dir)
    create_rules_file(data_dir)
    create_patterns_file(data_dir)

    print()
    print("Knowledge base initialization complete!")


if __name__ == "__main__":
    main()
