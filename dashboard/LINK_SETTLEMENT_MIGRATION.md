# Migração: Novo Modelo de Links com Settlement

## Contexto

O modelo de dados de transações (`transactions.json`) foi atualizado para suportar **visão líquida** baseada em dados concretos em vez de heurísticas por tipo de link. Cada link agora carrega dois campos novos que dizem explicitamente se e quanto ele compensa de valor.

## O que mudou no JSON

Cada objeto em `transaction.links[]` agora tem dois campos novos:

```typescript
interface TransactionLink {
  linked_to: string;
  type: LinkType;
  settles: boolean;        // NOVO — true = compensa valor, false = informativo
  settled_amount: number;   // NOVO — quanto do abs(amount) DESTA transação é compensado
  note?: string | null;
  confidence?: number;
  confirmed?: boolean;
}
```

Todos os links existentes na base já foram migrados com esses campos.

### Regras dos novos campos

1. `settles: true` + `settled_amount: X` → R$X desta transação são compensados por este link
2. `settles: false` + `settled_amount: 0` → link é puramente informativo (agrupamento, cadeia de dívida)
3. `settled_amount` é sempre >= 0
4. `sum(settled_amount where settles=true)` de uma transação nunca excede `abs(amount)`
5. Links são bidirecionais: se A→B existe, B→A também existe com o mesmo `settled_amount`

### Quais tipos usam `settles: true`

self_transfer, test_refund, estorno, split_bill, reimbursement, pass_through, overpayment_return, loan, loan_repayment

### Quais tipos usam `settles: false`

installment_group, debt_chain

## Impacto na Dashboard

### Dois modos de visualização

**Bruto**: mostra todas as movimentações com seus valores originais. Nenhum cálculo de settlement. Cada transação entra com `amount` original.

**Líquido**: usa `settles` e `settled_amount` para calcular o valor residual de cada transação:

```
Para cada transação:
  settled_total = sum(link.settled_amount para link in links onde link.settles === true)
  unsettled = abs(amount) - settled_total
  net_amount = sign(amount) * unsettled
```

- Se `net_amount === 0` → transação totalmente abatida, **não entra** na soma de KPIs/gráficos
- Se `net_amount !== 0` → entra com o valor residual
- Na **listagem** (tabela), a transação sempre aparece (ambos os modos), mas pode exibir o valor ajustado no modo líquido

### O que muda em cada arquivo

#### `src/types/transaction.ts`

Adicionar `settles` e `settled_amount` à interface `TransactionLink`:

```diff
 export interface TransactionLink {
   linked_to: string;
   type: LinkType;
+  settles: boolean;
+  settled_amount: number;
   note?: string | null;
+  confidence?: number;
   confirmed?: boolean;
 }
```

#### `src/domain/links.ts` — REESCREVER

O arquivo atual usa lógica de categorias (DROP_BOTH, NET_AGAINST_EXPENSE) para decidir o que fazer com cada tipo de link. Isso é frágil e não suporta abatimentos parciais reais.

O novo algoritmo é **data-driven** — usa `settles` e `settled_amount` diretamente:

```typescript
import type { Transaction } from '../types/transaction';

/**
 * Calcula o valor líquido de cada transação baseado nos settled_amounts dos links.
 *
 * - settles=true: o settled_amount reduz o abs(amount) da transação
 * - settles=false: informativo, não afeta o valor
 *
 * Retorna as transações com amount ajustado.
 * Transações totalmente abatidas (net_amount === 0) são removidas.
 */
export function applyLinkNetting(txs: Transaction[]): Transaction[] {
  const idSet = new Set(txs.map(t => t.id));

  return txs
    .map((t) => {
      const settledTotal = (t.links ?? [])
        .filter(l => l.settles && idSet.has(l.linked_to))
        .reduce((sum, l) => sum + (l.settled_amount ?? 0), 0);

      if (settledTotal === 0) return t;

      const absAmount = Math.abs(t.amount);
      const unsettled = Math.max(0, absAmount - settledTotal);
      const netAmount = Math.sign(t.amount) * unsettled;

      return { ...t, amount: netAmount };
    })
    .filter((t) => t.amount !== 0);
}
```

Notas importantes:
- `idSet.has(l.linked_to)` garante que só aplica netting se a contraparte está no conjunto filtrado (ex: se filtramos por mês e a contraparte é de outro mês, o link não se aplica)
- Não precisa mais classificar tipos de link — o `settles` já traz essa informação
- Suporta abatimentos parciais nativamente (duas receitas abatendo uma despesa parcialmente)

#### `src/domain/modes.ts` — AJUSTE MENOR

A lógica continua igual conceptualmente, mas o filtro de `transfer` e `invoice_payment` pode ser revisado. No modo líquido:
- Transações do tipo `transfer` que têm `settles: true` vão ser abatidas pelo netting (self_transfer zera ambos os lados)
- Transações do tipo `invoice_payment` não têm links settling, então precisam continuar sendo filtradas explicitamente

Sugestão: manter o filtro de `invoice_payment` mas remover o filtro de `transfer`, deixando o netting cuidar disso:

```typescript
export function applyMode(txs: Transaction[], mode: Mode): Transaction[] {
  if (mode === 'bruto') return txs;
  // invoice_payment é filtrado porque não tem links settling e não é gasto real
  const base = txs.filter(t => t.type !== 'invoice_payment');
  return applyLinkNetting(base);
}
```

Mas atenção: se existem `transfer` sem links (transferências não pareadas), elas vão aparecer no líquido. Se isso for indesejado, manter o filtro de `transfer` também.

#### `src/domain/aggregations.ts` — SEM MUDANÇA

As agregações (computeKPIs, computeMonthlyBars, etc.) operam sobre o `amount` das transações. Como o netting já ajusta o amount antes das agregações, não precisa de mudança.

#### Componentes de UI — OPCIONAL

Na tabela de transações (`TransactionsTable.tsx`), pode ser útil:
- Mostrar um indicador visual quando uma transação tem `settles: true` links (ex: ícone de "link" ou badge "abatido")
- No modo líquido, mostrar o valor original riscado e o valor líquido ao lado
- Mostrar tooltip com detalhes do settlement ao clicar/hover no indicador

## Exemplos Práticos

### Caso 1: Self-transfer (R$1.000 Nubank → Itaú)

```
Saída Nubank:  amount=-1000, links=[{linked_to: "entrada_itau", settles:true, settled_amount:1000}]
Entrada Itaú:  amount=+1000, links=[{linked_to: "saida_nubank",  settles:true, settled_amount:1000}]

Bruto: -1000 e +1000 aparecem → saldo 0, mas com R$2.000 de movimentação
Líquido: ambos zerados e removidos → nada aparece
```

### Caso 2: Jantar R$200, Pessoa A paga R$120, Pessoa B paga R$80

```
Jantar:       amount=-200, links=[
                {linked_to: "pessoa_a", settles:true, settled_amount:120},
                {linked_to: "pessoa_b", settles:true, settled_amount:80}
              ]
Pix Pessoa A: amount=+120, links=[{linked_to: "jantar", settles:true, settled_amount:120}]
Pix Pessoa B: amount=+80,  links=[{linked_to: "jantar", settles:true, settled_amount:80}]

Bruto: -200 +120 +80 → saldo 0 com R$400 de movimentação
Líquido: jantar settled_total=200, net=0 (removido). Pessoa A e B net=0 (removidos).
         Nada aparece — faz sentido, o jantar foi pago pelos outros.
```

### Caso 3: Compra R$500, reembolso parcial R$300

```
Compra:     amount=-500, links=[{linked_to: "reembolso", settles:true, settled_amount:300}]
Reembolso:  amount=+300, links=[{linked_to: "compra",    settles:true, settled_amount:300}]

Bruto: -500 +300 → gasto líquido -200, com R$800 movimentação
Líquido: compra net=-200 (aparece), reembolso net=0 (removido).
         Gasto real de R$200 — correto.
```

### Caso 4: Parcelas (3x R$100)

```
Parcela 1/3: amount=-100, links=[{linked_to: "parcela_2", settles:false, settled_amount:0}]
Parcela 2/3: amount=-100, links=[{linked_to: "parcela_1", settles:false}, {linked_to: "parcela_3", settles:false}]
Parcela 3/3: amount=-100, links=[{linked_to: "parcela_2", settles:false, settled_amount:0}]

Bruto: -100 -100 -100 → gasto -300
Líquido: mesma coisa — settles=false não abate nada. As 3 parcelas contam.
         O link permite agrupar e exibir "Compra X: 3 parcelas de R$100".
```

## Checklist de Migração

- [ ] Atualizar `TransactionLink` em `src/types/transaction.ts`
- [ ] Reescrever `applyLinkNetting` em `src/domain/links.ts`
- [ ] Ajustar `applyMode` em `src/domain/modes.ts` (remover filtro de `transfer` se desejado)
- [ ] (Opcional) Adicionar indicador visual de settlement na tabela
- [ ] (Opcional) Mostrar valor original vs líquido no modo líquido
- [ ] Testar cenários: self_transfer, reembolso total, reembolso parcial, parcelas, test_refund
