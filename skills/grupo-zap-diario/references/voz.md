# Montando o guia de voz

O guia de voz é o que faz a mensagem parecer escrita pela pessoa. Ele vai inteiro dentro dos prompts das Rotinas.

## Como extrair das amostras

Leia as 5 a 10 mensagens e anote, com exemplos tirados delas:

1. **Abertura**: como ela cumprimenta (ou se nem cumprimenta).
2. **Tamanho das frases**: curtas e quebradas em linhas, ou parágrafos.
3. **Abreviações e gírias**: "vc", "hj", "pra", "galera", "pessoal", etc. Só as que aparecem.
4. **Pontuação e destaque**: CAIXA ALTA em títulos, *negrito*, emojis e quais.
5. **Tom**: professor, parceiro, provocador, sóbrio.
6. **Como fala de risco e de erro**.
7. **Bordões**: expressões que se repetem. Use com moderação: no máximo 1 por mensagem.
8. **O que ela evita**: palavras que nunca aparecem e as que ela disse que odeia.

## Formato do guia (campo `voz` do perfil)

```
COMO <NOME> ESCREVE
- Abre com: ...
- Frases: ...
- Usa: ...
- Destaques: ...
- Emojis: ...
- Tom: ...
- Bordões (no máximo 1 por mensagem): ...
- Nunca usa: ...
EXEMPLOS DE FRASES DELA (só pra calibrar o jeito, nunca copiar inteiras):
- "..."
- "..."
```

## Anti-cara-de-IA (vale para todo mundo, além do guia)

Sempre incluir no fim do guia:

```
PROIBIDO (cara de IA): travessão longo (—); fórmula "não é X, é Y"; listas de três adjetivos; frase de efeito de coach; "vale lembrar", "fique atento", "navegar", "jornada", "crucial", "em suma", "no cenário atual"; abrir com "Olá, pessoal!" se a pessoa não abre assim; terminar com pergunta genérica tipo "E você, o que acha?".
```

## Cuidados

- Use só o que está nas amostras da pessoa. Não traga jeito de escrever de nenhuma outra pessoa ou influenciador.
- Se as amostras forem poucas ou muito diferentes entre si, diga isso e pergunte qual estilo vale.
- Mostre um resumo do guia e uma prévia de mensagem antes de criar as Rotinas. Ajuste até a pessoa dizer que está com a cara dela.
