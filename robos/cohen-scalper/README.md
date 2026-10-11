# CohenScalper (MQL5) — v1.19

Scalper de price action. Sem indicadores. Uso próprio em backtest e demo antes de qualquer versão para alunos (depois porta para NTSL).

## A regra

**Sinal (candle que acabou de fechar)**
- Corpo maior que 50% do tamanho total, ou seja, corpo maior que os pavios somados.
- Compra: candle de alta que fecha acima da máxima do candle anterior. Venda: o espelho.
- Tamanho total (máxima − mínima) de no máximo 2000 pontos (na prática, sem limite).
- Filtro de tendência opcional (desligado por padrão), detalhado abaixo.

**Entrada (no fechamento do candle sinal = abertura do seguinte)**
- Modo `retorno` (padrão): espera o candle seguinte recuar um mínimo (em % do candle sinal ou em pontos) e entra quando ele volta à abertura. Se perder o candle sinal antes, ou se o candle acabar sem voltar, não entra.
- Modo `abertura`: a mercado assim que o candle seguinte abre.
- Reentrada (padrão 1): saiu no 0x0 e o preço voltou à entrada em até 5 min → entra de novo, mesmo stop e alvos.

**Tendência (topos e fundos)**
- Topo: candle com máxima maior que a dos 2 candles de cada lado. Fundo: o espelho.
- Alta: os 2 últimos topos e os 2 últimos fundos ascendentes. Baixa: os dois descendentes. Qualquer outra coisa conta como sem tendência.
- Modos do filtro:
  - `desligado`: opera qualquer direção.
  - `só a favor`: compra só em alta e vende só em baixa. Sem tendência clara, não entra.
  - `depois do horário`: livre até o horário escolhido (padrão 13:00) e depois só a favor da tendência. Para esse modo valer, a última entrada precisa ser depois desse horário.

**Saída**
- Stop: 1 tick além da mínima (compra) ou da máxima (venda) do candle sinal.
- Parcial: metade da posição com 40 pontos. Ao bater a parcial, o stop vai para o 0x0.
- Alvo final: 180 pontos.

**Gestão**
- Entradas a partir de 09:15. Última entrada às 13:00. Zera às 17:30.
- Bloqueio de horários opcional (desligado por padrão): quando ligado, não entra em 09:30, 10:00, 10:30, 11:00 e 11:30, com margem de 5 min antes e depois. Exemplo para 09:30: não entra 09:25 nem 09:30; 09:35 já pode.
- Meta do dia de 500 pontos e loss do dia de 500 pontos, contados pelo preço médio (parcial 40 + final 180 = 110). Ao atingir qualquer um, para de abrir operações.
- Contratos sempre pares.
- Uma operação por vez.

Todos os números são parâmetros e podem ser otimizados no Strategy Tester.

## Instalar

1. No MT5: **Arquivo → Abrir pasta de dados → MQL5 → Experts**. Copie o `CohenScalper.mq5` para lá.
2. Abra no MetaEditor e compile (F7). Se der erro, mande o print da aba "Erros".
3. O robô aparece no Navegador, em Consultores Especialistas.

## Backtest

- **Modelagem:** "Cada tick baseado em ticks reais". Sem isso, o backtest de scalping não vale nada.
- **Ativo:** a série contínua do WIN que a sua corretora disponibiliza no MT5.
- **Período:** otimize em um bloco (ex.: 2024) e valide em outro que o robô nunca viu (ex.: 2025). Se só funciona no período otimizado, não tem vantagem real.
- **Custos:** o Tester não desconta os emolumentos da B3. Vamos descontar na análise dos resultados.
- O horário usado é o do servidor da corretora. Confirme que está em horário de Brasília.

## Armadilhas do testador (aprendidas na marra)

- **Depósito em BRL.** Em USD o testador não converte o resultado: lucro 0,00, ordens recusadas por margem e meses inteiros sem operação.
- **Ticks reais sempre.** "OHLC de 1 minuto" inventa o caminho do preço dentro do minuto e inflou o resultado em ~3x neste robô.
- **Atraso fixo (100 ms).** Atraso aleatório muda o resultado a cada rodada.
- **Histórico da XP:** o `WIN$N` não tem ticks de mar–set/2026. Valide em jan/2025–fev/2026 e use a conta demo para o período recente.
- **Série contínua não é contrato real.** `WIN$` e `WIN$N` dão resultados muito diferentes com os mesmos ticks, e às vezes a ordem stop dispara pelo último negócio e executa pelo bid/ask a centenas de pontos do gatilho (ex.: `WIN$N` 20/02/2026 14:55, buy stop 192475 executado a 192255). Desde a v1.23 o RESUMO mostra quantas execuções ficaram a mais de 50 pts do preço da ordem, quanto isso somou e o resultado se tudo executasse no preço da ordem, além do % de ticks com último negócio fora do bid/ask.

## Validação (v1.16, WIN$N, ticks reais, 2 contratos, sem custos)

Otimização em jan–set/2025, prova em out/2025–fev/2026 (Avançar do MT5):

| | Escolha (9 meses) | Prova (5 meses) |
|---|---|---|
| Resultado | R$ 9.682 | R$ 6.015 |
| Por mês | ~R$ 1.076 | ~R$ 1.203 |
| Pior queda | 0,71% | 0,45% |

A mesma configuração ficou em 1º lugar nos dois períodos. Tamanho máximo de 1.500 a 2.000 dá o mesmo resultado (platô). Filtro de tendência e 2–3 reentradas não melhoram.

## Parâmetros principais

| Parâmetro | Padrão | O que faz |
|---|---|---|
| Tempo gráfico | M5 | Tempo do candle sinal |
| Referência do fechamento | máxima/mínima | Fechar além da máxima/mínima ou do fechamento do anterior |
| Corpo maior que X% | 50 | Força mínima do candle |
| Tamanho máximo | 1000 | Candle sinal maior que isso é ignorado. Limita o stop por operação a ~R$ 400 com 2 contratos |
| Modo de entrada | retorno | `abertura` ou `retorno` |
| Recuo mínimo | 10% do candle sinal | Só no modo `retorno`. Também aceita pontos |
| Unidade do recuo | % do candle | `%`, `pontos` ou `FVG` (até a máx/mín do candle anterior ao sinal) |
| Entrar limitado no recuo | não | Sim: ordem limitada no ponto do recuo, sem esperar voltar à abertura |
| Filtro de tendência | desligado | `desligado`, `só a favor` ou `depois do horário` |
| Horário da tendência | 13:00 | Só no modo `depois do horário` |
| Força do pivô | 2 | Candles de cada lado para confirmar topo/fundo |
| Janela da tendência | 60 candles | Até onde procura os 2 últimos topos e fundos |
| Folga do stop | 1 tick | Distância além da mín/máx do sinal |
| Parcial | 40 pts / 50% | 0 desliga |
| Stop no 0x0 após parcial | sim | |
| Alvo final | 180 pts | |
| Bloquear horários | não | Liga o bloqueio da linha abaixo |
| Horários sem entrada | 09:30,10:00,10:30,11:00,11:30 | Separados por vírgula |
| Margem | 5 min | Antes e depois de cada horário |
| Última entrada | 1500 | HHMM, otimizável (ex.: 1300 a 1700) |
| Contratos | 2 | Sempre par |
| Meta do dia | 1500 pts | Preço médio. Custa ~0% (500 cortava 22%) |
| Loss do dia | 500 pts | Preço médio. Custa ~5% contra 1000 e cabe no bolso do varejo |
| Reentradas | 1 | Depois de sair no 0x0. 0 desliga |

## WIN x WDO

Os padrões do robô são de WIN. No WDO, rode outra instância trocando:

| Parâmetro | WIN | WDO |
|---|---|---|
| Parcial | 40 | 2 |
| Alvo final | 180 | 5 |
| Meta do dia | 500 | 15 |
| Tamanho máximo do candle | 500 | 10 |
| Loss do dia | 500 | 15 |

A folga do stop está em ticks e serve para os dois.

### Horário, meta e loss (v1.18)

Escolha em 2022–2024, prova em jan/2025–fev/2026, 2 contratos, sem custos:

| Última entrada · meta · loss | Escolha (36 meses) | Prova (14 meses) | Pior queda na prova |
|---|---|---|---|
| 13h · 500 · 500 (antigo) | abaixo do top 20 | abaixo do top 20 | — |
| **15h · sem meta · 1000** | 120.055 pts | 53.278 pts (~3.800/mês) | 0,75% |
| 17h · sem meta · 1000 | 158.528 pts | 52.772 pts | 1,01% |

Até 17h ganhou mais na escolha, mas empatou com 15h na prova com 26% mais negociações (mais custo) e queda maior. Ficou 15h.

### Versão varejo (v1.19, padrão)

Candle até 1.000, meta 1.500, loss 500, última entrada 15h. Escolhidos pelo risco, não pelo resultado. Backtest único jan/2022–fev/2026, 2 contratos, sem custos: 164.058 pts (~3.280/mês, ~R$ 1.300/mês), fator de lucro 1,31, pior queda R$ 2.008 (1,6%), ~17.150 operações (~9,6 pts cada). Contra a versão sem limites (15h, sem meta, loss 1000, candle 2000): −5%.

## Profit (NTSL) — `CohenScalper_Profit.ntsl` (v1.23)

Mesma regra da v1.19, só o que foi validado (sem filtro de tendência, bloqueio de horários e FVG).

1. Profit → Editor de Estratégias → cole o arquivo e compile. Erro aparece como `Parser[linha,coluna]`.
2. **Gráfico de 1 MINUTO, execução Tick a Tick** (backtest e automação). O candle de 5 min é acumulado (máx/mín/último) e avaliado quando começa o seguinte, sem ler histórico; o primeiro candle depois de ligar é descartado; prazos são por horário; a saída é identificada pelo último negócio. Em OHLC funciona, mas perde o 1º minuto do candle de entrada e o recuo/retorno dentro do minuto.
3. Parâmetros do painel não voltam ao padrão ao recompilar: confira um por um (a rodinha do mouse sobre o campo muda o valor). `Inicio` é palavra reservada no NTSL (por isso HoraInicio, HoraUltimaEntrada, HoraZerar).
4. Diferenças que ficam: entrada por ordem stop com limite de 20 ticks; reentrada por ordem limitada no preço da entrada (mesmo preço do MT5, sem risco de duplicar ordem); prazo da reentrada em minutos inteiros; preços de parcial e saída lidos do último negócio (o NTSL não informa o preço executado).

### Força do candle sinal (v1.20, em teste)

`InpForca`: `corpo` (padrão, corpo > 50%), `ponta` (fechamento a no máximo 33% do candle da máxima na compra / da mínima na venda — o martelo que fecha na direção entra) ou `corpo ou ponta`. Os outros filtros não mudam (fechar além da máx/mín anterior, tamanho, horário). Só vira padrão se ganhar no backtest de ticks reais.
