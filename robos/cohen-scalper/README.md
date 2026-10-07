# CohenScalper (MQL5) — v1

Scalper de price action. Sem indicadores. Uso próprio em backtest e demo antes de qualquer versão para alunos (depois porta para NTSL).

## A regra

**Sinal (candle que acabou de fechar)**
- Corpo maior que 50% do tamanho total, ou seja, corpo maior que os pavios somados.
- Compra: candle de alta que fecha acima da máxima do candle anterior. Venda: o espelho.
- Tamanho total (máxima − mínima) de no máximo 500 pontos.
- Não depende de tendência.

**Entrada (no fechamento do candle sinal = abertura do seguinte)**
- Modo `abertura`: a mercado assim que o candle seguinte abre.
- Modo `retorno`: espera o candle seguinte recuar um mínimo (em % do candle sinal ou em pontos) e entra quando ele volta à abertura. Se perder o candle sinal antes, ou se o candle acabar sem voltar, não entra.

**Saída**
- Stop: 1 tick além da mínima (compra) ou da máxima (venda) do candle sinal.
- Parcial: metade da posição com 40 pontos. Ao bater a parcial, o stop vai para o 0x0.
- Alvo final: 180 pontos.

**Gestão**
- Entradas a partir de 09:15. Última entrada às 13:00. Zera às 17:30.
- Sem entradas em 09:30, 10:00, 10:30, 11:00 e 11:30, com margem de 5 min antes e depois. Exemplo para 09:30: não entra 09:25 nem 09:30; 09:35 já pode.
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

## Parâmetros principais

| Parâmetro | Padrão | O que faz |
|---|---|---|
| Tempo gráfico | M5 | Tempo do candle sinal |
| Referência do fechamento | máxima/mínima | Fechar além da máxima/mínima ou do fechamento do anterior |
| Corpo maior que X% | 50 | Força mínima do candle |
| Tamanho máximo | 500 | Candle sinal maior que isso é ignorado |
| Modo de entrada | abertura | `abertura` ou `retorno` |
| Recuo mínimo | 10% do candle sinal | Só no modo `retorno`. Também aceita pontos |
| Folga do stop | 1 tick | Distância além da mín/máx do sinal |
| Parcial | 40 pts / 50% | 0 desliga |
| Stop no 0x0 após parcial | sim | |
| Alvo final | 180 pts | |
| Horários sem entrada | 09:30,10:00,10:30,11:00,11:30 | Separados por vírgula |
| Margem | 5 min | Antes e depois de cada horário |
| Última entrada | 13:00 | Teste outros horários |
| Contratos | 2 | Sempre par |
| Meta do dia | 500 pts | Preço médio. 0 desliga |
| Loss do dia | 500 pts | Preço médio. 0 desliga |

## WIN x WDO

Os padrões do robô são de WIN. No WDO, rode outra instância trocando:

| Parâmetro | WIN | WDO |
|---|---|---|
| Parcial | 40 | 2 |
| Alvo final | 180 | 5 |
| Meta do dia | 500 | 15 |
| Tamanho máximo do candle | 500 | a definir |
| Loss do dia | 500 | a definir |

A folga do stop está em ticks e serve para os dois.
