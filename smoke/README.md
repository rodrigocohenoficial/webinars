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

`etapa3.mjs` serve um **dublê da API do YouTube** no lugar da oficial (`smoke/dubles/youtube.js`).
Ele recusa reprodução automática com som e passa a permitir depois de um gesto real, que é o
comportamento do navegador que importa aqui. Assim o teste roda sem rede e ainda assim exercita
o código de verdade — mas a reprodução contra o provedor real precisa de uma conferida num
navegador com rede antes da primeira sessão pública.
