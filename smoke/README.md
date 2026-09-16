# Testes de fumaça

Navegador de verdade contra o servidor de verdade. Cada arquivo verifica uma etapa e,
principalmente, verifica que as armadilhas da especificação continuam fechadas.

```bash
npm i -D playwright        # não é dependência do projeto, só de quem testa
npm run dev                # em outro terminal
node smoke/etapa1.mjs
SLUG=meu-webinario node smoke/etapa2.mjs
```

`PW_CHROME=/caminho/do/chrome` usa um Chromium já instalado em vez de baixar outro.

O que cada um prova:

| Arquivo | Prova |
|---|---|
| `etapa1.mjs` | 5.1 recusa vídeo sem duração · 9.1 grade em memória · 9.7 formulário sobrevive ao erro · 9.9 erro é estado, não tela genérica |
| `etapa2.mjs` | 5.3 horário forjado no DOM é recusado pelo servidor · 4.1.6 mesmo e-mail não duplica · `.ics` com DTSTART em UTC · 5.6 nenhuma palavra proibida na tela do participante |
| `etapa3.mjs` | 4.3 vídeo posicionado em agora−início · 9.2 escada som → mudo → manual · 9.3 desmutar não dá seek · 9.4 cortina sobre a marca do provedor · deriva só corrigida acima de 3s · fases pelo relógio |

| `etapa4.mjs` | contagem regressiva · 9.5 vídeo de fundo recortado e não esticado · LATE com reinscrição em um clique · ENDED com próximos horários · 5.6 em todas as fases |

| `etapa5.mjs` | colar em lote com relatório linha a linha (6 motivos diferentes) · 9.8 sem `\r` no gravado · a trilha é revelada conforme o vídeo anda, não despejada · a trilha não gera consulta periódica |

| `etapa6.mjs` | 5.2 segundo enviado pelo cliente é grampeado no servidor · comentário nasce aguardando · 9.6 nada se declara feito antes da confirmação · liberar é aprovar: aparece na sala e entra na trilha da sessão seguinte |

| `etapa7.mjs` | batida de presença · 5.2 na presença · 9.11 apresentador fora de métrica, lista e CSV · 9.12 quem está assistindo é sinal recente · CSV exige login · curva em 40 pontos |

| `etapa8.mjs` | a oferta aparece no minuto e some no outro · clique gravado com o ponto do vídeo · só o primeiro clique conta · conversão sobre quem chegou ao minuto dela · oferta viaja junto do chat |

`etapa3.mjs` e `etapa4.mjs` servem um **dublê da API do YouTube** no lugar da oficial (`smoke/dubles/youtube.js`).
Ele recusa reprodução automática com som e passa a permitir depois de um gesto real, que é o
comportamento do navegador que importa aqui. Assim o teste roda sem rede e ainda assim exercita
o código de verdade — mas a reprodução contra o provedor real precisa de uma conferida num
navegador com rede antes da primeira sessão pública.
