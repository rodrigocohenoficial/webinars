# Fontes de dados

Toda chamada usa `curl -s -A 'Mozilla/5.0'`. Se uma fonte devolver erro, página HTML ou bloqueio, deixe o trecho de fora. Nunca contorne bloqueio (mudar cabeçalhos para parecer navegador, trocar IP, etc.).

## B3 (cotação pública, com atraso)

- Cotação: `https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/<TICKER>`
  Campos em `Trad[0].scty.SctyQtn`: `opngPric`, `minPric`, `maxPric`, `curPrc`, `prcFlcn` (variação %), `avrgPric` (VWAP). Volume: `Trad[0].ttlQty`.
- Série de 1 minuto do dia: `https://cotacao.b3.com.br/mds/api/v1/DailyFluctuationHistory/<TICKER>`
- Ibovespa oficial: ticker `IBOV`.
- Contrato vigente de WIN/WDO: o de maior `ttlQty` entre o mês atual e os 3 seguintes. Letras dos meses: F G H J K M N Q U V X Z. Ex.: `WINZ26`, `WDOF27`.
- WDO é em pontos. Nunca escreva "R$" para WDO.
- Já aconteceu de a B3 bloquear por algumas horas os contratos mais negociados. Nesse caso, sem níveis e sem gráfico.

## Yahoo Finance

`https://query1.finance.yahoo.com/v8/finance/chart/<SIMBOLO>?range=5d&interval=1d`
Variação = último fechamento vs anterior (ignore dias `null`).

| O quê | Símbolo |
|---|---|
| S&P 500 futuro | `ES=F` |
| S&P 500 | `^GSPC` |
| Nasdaq | `^IXIC` |
| Petróleo Brent / WTI | `BZ=F` / `CL=F` |
| Dólar global (DXY) | `DX-Y.NYB` |
| Juro 10 anos EUA | `^TNX` (já em %) |
| Dólar à vista | `BRL=X` |
| Ibovespa (reserva) | `^BVSP` |

**Rolagem**: contratos futuros (Brent, WTI) trocam de vencimento e o Yahoo pode mostrar uma variação falsa, com o sinal trocado. Compare Brent com WTI: se apontarem para lados opostos ou a diferença passar de 2 pontos percentuais, confirme em notícia antes de publicar o número. Se não confirmar, publique só a direção.

## Cripto

`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,brl&include_24hr_change=true`

## Notícias e agenda

WebSearch + WebFetch em veículos sérios (InfoMoney, Valor, Money Times, Reuters, Bloomberg Línea). Agenda sempre no horário de Brasília (ou no fuso do perfil). Antes de dizer que algo "disparou" ou "despencou", confira o número: só acima de 2%.

## Feriados

Antes de gerar qualquer mensagem, confira se hoje tem pregão na B3. Fim de semana ou feriado: a Rotina termina sem enviar.
