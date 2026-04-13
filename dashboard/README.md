# Ledger — Nordic Finance Dashboard

Dashboard local de finanças pessoais. Lê `../data/transactions.json` (gerado pela skill `finance-tracker`) e renderiza visões agregadas.

## Como rodar

```bash
npm install
npm run dev
# abre http://localhost:5173
```

Sempre que o JSON em `../data/transactions.json` for atualizado, o Vite recarrega automaticamente.

## Estrutura

```
src/
├── data/         loader (?raw + sanitização de NaN) e hook
├── domain/       modes (bruto/líquido), links, agregações, períodos, labels
├── format/       formatadores Intl pt-BR
├── components/   layout, kpi, chips, charts, table, pickers
└── pages/        Visão Geral (anual) e Visão Mensal
```

## Modos

- **Fluxo de Caixa (Bruto)**: tudo conta — receitas, gastos, transferências, pagamentos de fatura.
- **Economia Real (Líquido)**: exclui transferências entre contas próprias e pagamentos de fatura, e aplica netting de links (test_refund pares zeram, reembolsos diminuem despesas, etc.).

## Design system

"Nordic Ledger" (light) — tokens em `src/index.css` via `@theme`. Sage teal `#396660`, Inter, ROUND_FOUR (4px). Regra "no-line": tonalidade > borders.
