---
name: finance-tracker
description: Gerenciador inteligente de finanças pessoais com aprendizado contínuo. Recebe listas de transações (planilha Organizze XLS e/ou extrato Flash CSV), analisa, categoriza, detecta duplicatas, encontra vínculos entre transações (reembolsos, divisão de contas, repasses, pagamentos de fatura) e mergeia na base de dados principal. Aprende padrões ao longo do tempo para reduzir intervenção manual. Use esta skill sempre que o usuário mencionar: transações financeiras, extrato bancário, finanças pessoais, categorizar gastos, receitas e despesas, importar movimentações, Open Finance, Organizze, Flash benefício, fatura de cartão, dividir conta, reembolso, ou qualquer variação de controle financeiro pessoal. Também acione quando o usuário enviar arquivos XLS/CSV de transações bancárias, pedir relatórios financeiros, ou quiser ajustar/corrigir transações existentes.
---

# Finance Tracker

Skill para gerenciamento inteligente de finanças pessoais com aprendizado contínuo.

## Princípios Fundamentais

1. **Trabalho colaborativo**: O agente NUNCA toma decisões complexas sozinho. Transações ambíguas, vínculos entre pessoas, e categorizações incertas devem SEMPRE ser confirmadas pelo usuário.
2. **Confirmação antes de gravar**: Antes de commitar qualquer dado, apresente um resumo ao usuário e peça confirmação explícita.
3. **Perguntas pontuais**: Quando houver dúvida, faça perguntas objetivas ao usuário em vez de assumir. Use AskUserQuestion quando possível para facilitar respostas rápidas.
4. **Resumo final obrigatório**: Ao final de QUALQUER operação (processamento, edição, correção), apresente um resumo completo do que foi feito e faça perguntas de verificação sobre pontos críticos.
5. **Aprendizado contínuo**: Toda correção do usuário deve atualizar a knowledge base para evitar os mesmos erros no futuro.
6. **Vínculos bidirecionais**: Todo link entre transações DEVE ser bidirecional. Se A é vinculada a B, então A.links deve conter B e B.links deve conter A. Ao criar vínculos manualmente (no passo 4b), use `commit.py add-link` que garante bidirecionalidade. Ao editar links diretamente na base, sempre atualize ambos os lados. Ao deletar uma transação, os links reversos são limpos automaticamente pelo `commit.py delete`.

## Caminhos Importantes

Antes de qualquer operação, determine o caminho raiz do workspace do usuário. Os dados ficam em:

- **Base de dados**: `{workspace}/data/transactions.json`
- **Base de conhecimento**: `{workspace}/data/knowledge/` (merchants.json, people.json, rules.json, patterns.json)
- **Scripts**: na pasta `scripts/` desta skill

Se a base de dados ou knowledge base não existirem, inicialize-os executando:
```bash
python {skill_path}/scripts/init_knowledge.py {workspace}/data
```

## Pipeline de Processamento

Quando o usuário enviar transações, siga esta ordem rigorosamente:

### Passo 1: Ingestão

Execute o script de ingestão para converter os arquivos brutos em JSON normalizado:

```bash
python {skill_path}/scripts/ingest.py \
  --input {arquivo_do_usuario} \
  --output /tmp/ingested.json \
  --source-type organizze|flash
```

O script detecta automaticamente o tipo pelo formato. Organizze = XLS com múltiplas abas. Flash = CSV com colunas Data, Hora, Movimentação.

O script ignora a aba "Flash" do Organizze (são lançamentos manuais, substituídos pelo extrato real do Flash).

Leia o output para entender quantas transações foram extraídas e de quais fontes.

### Passo 2: Merge e Deduplicação

```bash
python {skill_path}/scripts/merge.py \
  --new /tmp/ingested.json \
  --db {workspace}/data/transactions.json \
  --knowledge {workspace}/data/knowledge \
  --output /tmp/merge_report.json
```

O script gera um relatório com:
- `new_transactions`: transações novas a serem adicionadas
- `duplicates`: transações já existentes na base (ignoradas)
- `conflicts`: transações similares mas não idênticas (precisam de revisão)
- `self_transfers`: transferências entre contas próprias detectadas
- `invoice_payments`: pagamentos de fatura detectados (débitos em conta que correspondem a faturas de cartão)

**Leia o relatório com atenção.** Se houver `conflicts`, apresente-os ao usuário para decisão.

### Passo 3: Categorização

```bash
python {skill_path}/scripts/categorize.py \
  --transactions /tmp/merge_report.json \
  --knowledge {workspace}/data/knowledge \
  --output /tmp/categorized.json
```

O script aplica regras da knowledge base e retorna:
- `auto_categorized`: transações categorizadas automaticamente com alta confiança
- `needs_review`: transações sem categoria ou com baixa confiança

**Para as transações em `needs_review`:** apresente-as ao usuário agrupadas por padrão (ex: todas do mesmo comerciante juntas). Quando o usuário confirmar a categoria, atualize a knowledge base.

### Passo 4a: Detecção de Vínculos Determinísticos (Script)

```bash
python {skill_path}/scripts/link_detector.py \
  --transactions /tmp/categorized.json \
  --db {workspace}/data/transactions.json \
  --knowledge {workspace}/data/knowledge \
  --output /tmp/links_report.json
```

O script detecta **apenas vínculos simples e determinísticos** que não precisam de contexto humano:
- **self_transfer**: transferências entre contas próprias do usuário. Mesma pessoa (self), valores opostos, contas diferentes, até 3 dias de diferença.
- **test_refund**: pares de débito/crédito do Pagar.me (testes de checkout do site). Cada crédito casa com exatamente 1 débito (1:1), evitando pareamento múltiplo.
- **estorno**: créditos com palavras-chave explícitas ("Estorno", "Crédito de", "Devolução", "Reembolso") e mesmo valor de um débito anterior.
- **installment_group**: parcelas com marcador EXPLÍCITO na descrição (ex: "1/3", "2/10", "Pcl4de12", "Parcelado em 2 de 5"). Exige: mesmo valor, mesma descrição normalizada, **mesmo cartão** (source), pelo menos 20 dias entre parcelas e invoice_ref diferentes. **Transações sem marcador X/Y NÃO são auto-linkadas** — mesmo com mesmo nome e valor, podem ser assinaturas (streaming, celular, barbeiro) ou coincidências (IOF, corridas Uber). Esses casos ambíguos vão para `suggested_links` (confiança 0.50) para o agente revisar com o usuário.

Links com confiança >= 0.8 são aplicados automaticamente. **Estes são os únicos vínculos automáticos** — todo o resto passa pelo agente.

### Passo 4b: Vinculação Complexa pelo Agente (COLABORATIVO)

Após o script processar vínculos determinísticos, **o agente analisa transações sem vínculo** e propõe links complexos ao usuário. Este passo é SEMPRE interativo.

**Tipos de vínculo que o agente deve buscar:**
- **split_bill**: receita de pessoa conhecida como ~50% de despesa recente (dividiu a conta)
- **reimbursement**: receita que cobre 100% ou parte de despesa anterior (devolução, empréstimo devolvido)
- **pass_through**: receita de A seguida de despesa para B de mesmo valor (repasse de dinheiro)
- **debt_chain**: pagamento de dívida em cadeia (ex: Person A → User → Person B)
- **overpayment_return**: pessoa pagou a mais, usuário devolveu a diferença
- **loan**: empréstimo feito pelo usuário a outra pessoa (saída sem vínculo com despesa de consumo)

**Candidatos ambíguos do script (suggested_links com confiança 0.50):**
O script também reporta transações recorrentes de mesmo valor e nome SEM marcador de parcela. O agente deve apresentá-las ao usuário e perguntar se são: (a) parcelas reais que faltam marcador, (b) assinaturas/recorrências, ou (c) coincidências. Nunca auto-commit esses links.

**Procedimento obrigatório:**

1. **Levantar candidatos**: Listar todas as receitas sem vínculo, especialmente de contrapartes conhecidas (people.json). Também listar saídas para pessoas conhecidas que não sejam despesas de consumo (possíveis empréstimos, devoluções).

2. **Cruzar com despesas**: Para cada receita de pessoa conhecida, buscar despesas compatíveis:
   - split_bill: buscar despesas de 30-110% do valor recebido, até 10 dias antes
   - reimbursement: buscar despesas de valor similar (tolerância de R$1), até 30 dias antes
   - pass_through: buscar saídas para outra pessoa com valor similar, até 5 dias depois
   - Verificar patterns.json para debt_chains conhecidas

3. **Apresentar ao usuário POR PESSOA**, em tabela com contexto:
   ```
   **Roommate** (divide contas de casa):
   | Data   | Descrição                   | Valor      | Proposta de vínculo                              |
   |--------|-----------------------------|------------|--------------------------------------------------|
   | 09/01  | Roommate → Usuário          | +R$1.017   | Parte do aluguel? (Imobiliária -R$1.583 mesma data) |
   | 04/03  | Usuário → Roommate          | -R$1.300   | Empréstimo?                                      |
   ```

4. **Usar AskUserQuestion** para confirmações agrupadas quando possível. Ex: uma pergunta por pessoa com opções de confirmação.

5. **Fazer perguntas de aprofundamento** quando o contexto não for claro:
   - "O R$2.960 do [Roommate] em 18/03 são contas de casa acumuladas ou inclui outra coisa?"
   - "O [Parceiro(a)] te mandou R$443 em 09/03 — é para pagar alguma compra específica?"
   - Nunca vincular na dúvida. É melhor perguntar do que errar.

6. **Gravar apenas após confirmação explícita** do usuário. Atualizar knowledge base com os padrões confirmados.

**Erros comuns a evitar (aprendidos):**
- NÃO vincular receitas de uma pessoa a despesas genéricas sem relação (ex: parceiro(a) ↔ condomínio é errado se quem paga condomínio é o roommate)
- NÃO vincular pagamento de fatura de cartão a despesas aleatórias (ex: Fatura ↔ seguro auto é falso positivo — a fatura cobre TODAS as despesas do cartão, não uma específica)
- NÃO vincular transferências de pessoas diferentes entre si (ex: Pessoa A ↔ Pessoa B — são pessoas distintas)
- NÃO vincular rendimento automático (REND PAGO APLIC) como reembolso de nada
- Cuidado com pagamentos onde a pessoa mandou MAIS do que o necessário (overpayment_return): buscar se houve devolução do troco

### Passo 5: Confirmação e Commit

**ANTES de commitar**, apresente um resumo completo:

```
=== RESUMO DO PROCESSAMENTO ===
Novas transações: X
Duplicatas ignoradas: Y
Categorizadas automaticamente: Z
Categorizadas pelo usuário: W

Vínculos determinísticos (script): N
  - X self-transfers
  - Y test_refunds (Pagar.me)
  - Z estornos
  - W parcelas (installment_group)

Vínculos complexos (confirmados): N
  - X reimbursements
  - Y split_bills
  - ...

Categorias mais frequentes:
  - Transporte: X txs
  - Alimentação: Y txs
  - ...
```

**Pergunte ao usuário: "Posso commitar? Algo para ajustar antes?"**

Após confirmação:

```bash
python {skill_path}/scripts/commit.py \
  --transactions /tmp/categorized.json \
  --links /tmp/links_report.json \
  --db {workspace}/data/transactions.json \
  --knowledge {workspace}/data/knowledge
```

### Passo 6: Resumo Final e Verificação

Após o commit, SEMPRE apresente:

**A) Resumo executivo:**
- Quantas transações foram adicionadas
- Quantas duplicatas foram ignoradas
- Vínculos criados (por tipo)
- Novas regras aprendidas / knowledge base atualizada

**B) Perguntas de verificação sobre pontos críticos:**
Revise mentalmente todo o processamento e identifique pontos que merecem atenção. Exemplos:
- "Notei X transações de receita que ficaram sem vínculo e sem categoria clara. Quer que eu investigue?"
- "O [Roommate] ainda não pagou as contas de abril. Quer que eu anote isso na base?"
- "Vi 3 comerciantes novos que categorizei como 'Outros'. Quer ajustar algum?"
- "Encontrei Y transações com valor alto (> R$500) na categoria 'Outros'. Valem uma revisão?"

**C) Oferecer próximos passos:**
- "Quer ver um relatório de gastos por categoria?"
- "Quer que eu verifique se há transações recorrentes que mudaram de valor?"
- "Precisa corrigir algum vínculo?"

## Fluxo de Interação: Exemplo Completo

Para ilustrar como os passos devem fluir na prática:

1. Usuário envia planilha XLS
2. Agente roda ingestão + merge + categorização silenciosamente
3. Se houver `needs_review`: apresenta ao usuário agrupado, pede categorias
4. Agente roda link_detector (determinístico)
5. Agente analisa receitas/saídas sem vínculo e monta propostas por pessoa
6. **Apresenta os vínculos determinísticos** (info: "o script pareou X self-transfers, Y Pagar.me, etc.")
7. **Apresenta propostas de vínculos complexos** por pessoa, com AskUserQuestion
8. Usuário responde — agente faz perguntas de follow-up se necessário
9. Agente aplica correções e mostra resumo pré-commit
10. Após confirmação, commita
11. Mostra resumo final + perguntas de verificação + próximos passos

## Apresentação ao Usuário

Ao apresentar transações para revisão, use formato de tabela conciso. Agrupe por tema quando fizer sentido. Exemplo:

```
| Data       | Descrição              | Valor     | Categoria  | Vínculo sugerido        |
|------------|------------------------|-----------|------------|-------------------------|
| 09/04/2026 | Pessoa Conhecida       | +60,00    | ?          | Split: despesa XYZ?     |
```

Quando perguntar sobre categorias, ofereça a lista de categorias conhecidas como opções.

**Formatação dos valores**: Use formato brasileiro quando apresentar ao usuário (R$ 1.234,56). Internamente, armazene como float.

## Operações Manuais

O usuário pode pedir:
- **Alterar**: mudar categoria, descrição ou vínculo de uma transação existente
- **Incluir**: adicionar transação manual (sem arquivo)
- **Excluir**: remover transação da base
- **Recategorizar em lote**: mudar categoria de todas as transações de um comerciante

Para estas operações, use o script de commit com subcomandos:
```bash
python {skill_path}/scripts/commit.py edit --id {transaction_id} --field category --value "Nova Categoria" --db {workspace}/data/transactions.json --knowledge {workspace}/data/knowledge
python {skill_path}/scripts/commit.py delete --id {transaction_id} --db {workspace}/data/transactions.json
python {skill_path}/scripts/commit.py add --json '{...}' --db {workspace}/data/transactions.json --knowledge {workspace}/data/knowledge
```

Para criar vínculos bidirecionais entre transações:
```bash
python {skill_path}/scripts/commit.py add-link --id-a {tx_id_1} --id-b {tx_id_2} --type reimbursement --note "Contexto" --db {workspace}/data/transactions.json --knowledge {workspace}/data/knowledge
```

Para reparar vínculos unidirecionais existentes (adiciona links reversos onde faltam):
```bash
python {skill_path}/scripts/commit.py repair-links --db {workspace}/data/transactions.json --knowledge {workspace}/data/knowledge
```

Sempre confirme com o usuário antes de executar operações destrutivas (excluir).

## Base de Conhecimento

A knowledge base fica em `{workspace}/data/knowledge/` e contém:

### merchants.json
Mapa de nomes de comerciantes (normalizados) para categoria. Atualizado toda vez que o usuário confirma uma categoria para um comerciante novo.

### people.json
Pessoas conhecidas com seus nomes variantes e padrões típicos de transação. **Fundamental para vinculação complexa.** Contém:
- Variantes de nome (como aparecem na planilha)
- Relacionamento (namorada, roommate, tia, devedor, avó, etc.)
- Padrões típicos (split_bill, reimbursement, loan, debt_payment, etc.)
- Notas detalhadas sobre padrões de comportamento financeiro

Exemplo: Parceiro(a) → split_bill + overpayment_return (petshop); Roommate → reimbursement de contas de casa + loan; Devedor → debt_payment pass-through para credor final.

### rules.json
Regras gerais de categorização baseadas em padrões de descrição. Ex: "PIX QRS RECEITA FED" → Impostos e Taxas, "Pagar.me" → Trabalho.

### patterns.json
Padrões recorrentes detectados: debt_chains (Pessoa A → Usuário → Pessoa B), recurring (aluguel, condomínio, luz, internet), invoice_patterns (quais contas pagam quais faturas).

**Princípio de atualização**: atualize a knowledge base TODA VEZ que o usuário corrigir uma categorização ou confirmar um vínculo. O objetivo é que, com o tempo, menos transações precisem de revisão humana.

Para atualizar a knowledge base programaticamente, use:
```bash
python {skill_path}/scripts/knowledge.py \
  --action add_merchant|add_rule|add_person|add_pattern \
  --knowledge {workspace}/data/knowledge \
  --data '{...}'
```

## Quando Perguntar ao Usuário

Pergunte SEMPRE quando:
1. Uma receita de pessoa conhecida não tem vínculo óbvio com despesa
2. Um vínculo proposto tem múltiplos candidatos possíveis
3. Um comerciante novo aparece sem categoria
4. O valor de uma transação é atipicamente alto para sua categoria
5. Há conflito na deduplicação (similar mas não idêntico)
6. Transferências de/para pessoas que podem ser empréstimo ou despesa compartilhada
7. Pagamentos de uma pessoa com valor que não bate com nenhuma despesa clara
8. Saídas para pessoas conhecidas que podem ser empréstimos ou devoluções

**Estilo das perguntas:**
- Seja conciso e direto
- Agrupe transações da mesma pessoa na mesma pergunta
- Ofereça opções quando possível (AskUserQuestion)
- Inclua contexto relevante: "R$2.960 do [Roommate] — são contas de casa acumuladas ou inclui outra coisa?"
- Quando não souber, pergunte abertamente: "Qual é o contexto dessa transferência?"

## Padrões Especiais Conhecidos

### Pagar.me (testes de checkout)
Transações do Pagar.me e "Pg *Aora" são testes de checkout de um site que o usuário está desenvolvendo. Sempre vêm em pares (débito + crédito de mesmo valor). Devem ser categorizadas como "Trabalho" e vinculadas como test_refund 1:1. O impacto líquido é zero. O script cuida disso automaticamente.

### Cadeia de dívida (debt chain)
Quando uma pessoa (Devedor) deve dinheiro ao usuário e o usuário repassa para outra pessoa (Credor final), isso é um pass_through. A receita do devedor e a despesa para o credor final devem ser vinculadas. Configure estes padrões em patterns.json → debt_chains.

### Flash (benefício VA/VR)
Todas as transações do extrato Flash são alimentação/refeição. Os "Depósito transferido" são créditos do benefício empresa. Transações do Flash que não têm categoria devem ser categorizadas como "Alimentação" (restaurantes, delivery) ou "Mercado" (supermercados) baseado no nome do estabelecimento.

### Pagamentos de fatura
O pagamento de fatura na conta corrente (ex: "FATURA PAGA BANCO X") NÃO é um gasto real — é apenas a liquidação financeira dos itens de fatura do cartão, que já estão registrados individualmente. Esses pagamentos devem ter type="invoice_payment" e não devem ser contados como despesa no orçamento. **NÃO vincular fatura a despesas individuais** — a fatura cobre TODAS as despesas do cartão naquele mês, não uma específica.

### Conta PJ → PF (renda de prestação de serviço)
Se o usuário tem uma conta pessoa jurídica (CNPJ), transferências da PJ para as contas PF são **renda real** (pagamento de clientes por prestação de serviço). Na planilha da PF, aparece apenas o lado de entrada (positivo) com descrição tipo "XX.XXX.XXX Nome do Usuário". Estas NÃO são self-transfers — devem ser categorizadas como "Salário" e type="income".

Para distinguir PJ income de self-transfer:
- Descrições com prefixo numérico tipo CNPJ são SEMPRE PJ income
- Se há entrada E saída de mesmo valor com nome do usuário (sem CNPJ) no mesmo lote → self_transfer
- Se há apenas entrada positiva com nome do usuário sem saída correspondente → verificar se é PJ income ou self-transfer de conta de investimento

### Empréstimos e contas de casa com roommate
Se o usuário divide moradia com alguém, essa pessoa pode dividir aluguel, condomínio e contas da casa. O usuário também pode emprestar dinheiro e cobrar juros (ex: emprestou R$1.300, cobrou R$1.400 de volta = R$100 de juros). Pagamentos do roommate podem incluir múltiplos itens (contas de casa + devolução de empréstimo com juros) em uma única transferência. **Sempre perguntar** qual é a composição quando o valor é atípico. Saídas do usuário para o roommate podem ser empréstimos (categorizar como "Empréstimos") ou devoluções.

### Parceiro(a) e compras compartilhadas
O parceiro(a) do usuário pode dividir contas de restaurante, mercado, etc. (split_bill). Pode haver cenários de overpayment_return: a pessoa manda dinheiro, o usuário paga algo, e devolve o troco. Também pode comprar coisas online via o usuário e reembolsar. **Atenção**: nem todas as pessoas conhecidas estão relacionadas às mesmas despesas — consulte people.json para entender os padrões de cada pessoa.

### Processadores de pagamento e reembolsos
Alguns processadores de pagamento (ex: gateways de e-commerce) geram reembolsos parciais de compras anteriores. Atentar para as datas — o reembolso deve ser POSTERIOR à compra original (nunca antes).

## Detalhes Técnicos

### Deduplicação
O ID de cada transação é um hash SHA-256 baseado em:
- Para Organizze: (source_sheet, date, description, amount, occurrence_index)
- Para Flash: (date, time, description, amount)

O `occurrence_index` resolve o caso de transações idênticas legítimas (ex: 2 Uber no mesmo dia pelo mesmo valor). Ele é o índice ordinal dentro do grupo de transações com mesmo (date, description, amount) na mesma source.

Parcelas NÃO são duplicatas — mesmo valor e descrição, mas faturas diferentes → transações distintas.

### Formato do Valor
Todas as transações são armazenadas com valor em float:
- Negativo = despesa/saída
- Positivo = receita/entrada

### Tipos de Transação
- `expense`: gasto real
- `income`: receita real (salário, freelance, etc.)
- `transfer`: transferência entre contas próprias (não é gasto nem receita)
- `invoice_payment`: pagamento de fatura de cartão (não duplicar com itens da fatura)
- `benefit_credit`: crédito de benefício (Flash)

### Tipos de Vínculo e Comportamento de Settlement

Cada link tem dois campos que controlam a visão líquida:
- `settles` (boolean): se `true`, o link compensa valor entre as transações
- `settled_amount` (float >= 0): quanto do `abs(amount)` desta transação é compensado por este link

**Fórmula da visão líquida:**
```
settled_total = sum(link.settled_amount for link in links if link.settles)
unsettled = abs(amount) - settled_total
net_amount = sign(amount) * unsettled
# Se net_amount == 0, a transação não entra na soma líquida
```

**Invariantes:**
1. `sum(settled_amount)` de uma transação nunca excede `abs(amount)`
2. Para links bidirecionais com `settles=true`, o `settled_amount` é igual nos dois lados
3. Links com `settles=false` sempre têm `settled_amount=0`

**Tipos que COMPENSAM valor (settles=true):**
- `self_transfer`: transferência entre contas próprias (determinístico, script) — settled_amount = valor integral
- `test_refund`: par débito/crédito Pagar.me (determinístico, script) — settled_amount = valor integral
- `estorno`: crédito com keyword explícita (determinístico, script) — settled_amount = valor integral
- `split_bill`: divisão de conta com pessoa conhecida (complexo, agente) — settled_amount = valor recebido da pessoa
- `reimbursement`: reembolso ou devolução de empréstimo (complexo, agente) — settled_amount = valor reembolsado
- `pass_through`: repasse de dinheiro entre terceiros (complexo, agente) — settled_amount = valor repassado
- `overpayment_return`: devolução de troco/excedente (complexo, agente) — settled_amount = valor devolvido
- `loan`: empréstimo feito a pessoa conhecida (complexo, agente) — settled_amount = valor emprestado
- `loan_repayment`: devolução de empréstimo com possível juros (complexo, agente) — settled_amount = valor devolvido

**Tipos INFORMATIVOS (settles=false, settled_amount=0):**
- `installment_group`: parcelas do mesmo item em meses diferentes (determinístico para parcelas com marcador X/Y; ambíguo/sugerido para recorrências sem marcador) — mantém o vínculo para visão de compromissos futuros, mas cada parcela conta individualmente como despesa
- `debt_chain`: cadeia de pagamento de dívida (complexo, agente) — informativo, o settlement real acontece via pass_through

Leia `references/schema.md` para o schema completo da transação e `references/categories.md` para a taxonomia de categorias.
