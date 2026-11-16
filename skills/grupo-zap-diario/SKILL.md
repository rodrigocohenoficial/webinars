---
name: grupo-zap-diario
description: Monta e mantém o envio automático de 3 mensagens por dia (manhã, tarde se relevante e fechamento) num grupo ou comunidade de WhatsApp de um trader, na voz dele, via Z-API e Rotinas do Claude Code. Use quando alguém disser que quer "mensagens automáticas no grupo do zap", "highlights do mercado no WhatsApp", "instalar o grupo diário", "configurar o envio do meu grupo", pedir para mudar horário, voz, links ou destino dessas mensagens, ou perguntar por que a mensagem do dia não saiu.
---

# Grupo do Zap diário

Esta skill instala, na conta de quem está usando, um sistema que manda todo dia útil:

1. **Manhã**: abertura do dia (o que aconteceu ontem, lá fora, agenda, níveis se for o caso, enquete).
2. **Tarde**: só se algo relevante aconteceu. Na dúvida, não manda.
3. **Fechamento**: o dia em 1 minuto, lição para quem está começando, convite para encaminhar e enquete de como foi o dia.

Tudo sai na voz da pessoa, construída a partir de mensagens reais dela. Nada desta skill pertence a outra pessoa: não copie voz, bordões, links, grupos ou histórias de ninguém além de quem está instalando.

## Modos

Descubra pelo pedido qual modo usar. Na dúvida, pergunte.

| Modo | Quando | O que fazer |
|---|---|---|
| INSTALAR | Primeira vez, ou "quero configurar" | Seguir **Instalação** inteira |
| AJUSTAR | Mudar horário, voz, link, destino, mercados | Editar `perfil.json`, rodar `gerar_prompts.py`, atualizar as Rotinas com `update_trigger` |
| PRODUÇÃO | "Pode mandar no grupo oficial" | Trocar `modo` para `oficial` no perfil, regerar, atualizar as 3 Rotinas |
| DIAGNOSTICAR | "Não saiu hoje", "por que falhou" | Seguir `references/diagnostico.md` |

## Instalação

Faça na ordem. Não pule etapas. Uma pergunta ou bloco curto de perguntas por vez, sempre com uma sugestão padrão que a pessoa possa só aceitar.

### 1. Pré-requisitos (confira antes de perguntar qualquer outra coisa)

Explique em linguagem simples e confirme que a pessoa tem:
- Claude Code na web (claude.ai/code) com Rotinas disponíveis no plano.
- Uma conta na Z-API (z-api.io) com uma instância conectada a um número de WhatsApp.
- Esse número como **administrador** do grupo ou comunidade (em comunidade, o grupo de avisos só aceita mensagem de admin).
- Um grupo de teste com esse número como admin. Tudo roda primeiro nele.

Se faltar algo, diga exatamente o que falta e pare até resolver.

### 2. Entrevista

Siga `references/entrevista.md`. Ela produz o `perfil.json`. Pontos que não podem faltar:
- **Voz**: peça de 5 a 10 mensagens reais que a pessoa já mandou em grupo ou postou. Monte o guia de voz com `references/voz.md`. Sem amostras, avise que o texto vai sair genérico e ofereça seguir mesmo assim só se ela insistir.
- **Recomendação**: pergunte se ela vai publicar níveis, cenários ou recomendações. A decisão e a responsabilidade são dela. Antes de registrar a resposta, mostre uma vez o aviso de `references/compliance.md` e peça um "ok, entendi".

### 3. Credenciais e permissão de envio

Siga `references/ambiente.md`. Resumo:
- As credenciais da Z-API entram como variáveis de ambiente do ambiente da nuvem (`ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`), configuradas pela própria pessoa na tela do ambiente. **Nunca peça para colar credencial no chat** e nunca escreva o valor de uma credencial em comando, arquivo ou mensagem.
- O script de setup do ambiente cria a regra que libera o comando exato de envio. Sem ela, o envio automático tende a ser bloqueado.
- A pessoa precisa abrir uma sessão nova depois de salvar o ambiente, para as variáveis valerem.

### 4. Escolher os grupos

Rode `python3 scripts/listar_grupos.py` (precisa das variáveis da etapa 3). Mostre os grupos **pelo nome** e peça para a pessoa escolher o de teste e o oficial. Grave os IDs no perfil. Não mostre IDs a não ser que ela peça.

### 5. Gerar e testar

1. Salve o perfil em `perfil.json` na pasta de trabalho da pessoa (fora desta skill).
2. Rode `python3 scripts/gerar_prompts.py perfil.json saida/`. Isso gera um prompt completo por Rotina, com os scripts embutidos.
3. Faça um envio de teste manual no grupo de teste, com uma mensagem curta de "teste de configuração", usando `scripts/enviar.py`. Peça para a pessoa confirmar que chegou.
4. Gere uma prévia da mensagem da manhã com dados de hoje e mostre no chat, sem enviar. Ajuste a voz até a pessoa aprovar.

### 6. Criar as Rotinas

Crie uma Rotina por mensagem com `create_trigger`, sempre com `create_new_session_on_fire: true` e o prompt lido de `saida/<rotina>.txt` sem alterar:

| Rotina | Nome sugerido | Cron (fuso da pessoa) |
|---|---|---|
| manha | `Grupo · manhã` | horário da manhã menos 8 minutos, seg a sex |
| tarde | `Grupo · tarde se relevante` | horário da tarde, seg a sex (pule se a pessoa não quer tarde) |
| fechamento | `Grupo · fechamento` | horário do fechamento, seg a sex |

Use `CRON_TZ=America/Sao_Paulo` (ou o fuso que a pessoa informou). A Rotina leva de 5 a 8 minutos para buscar dados e escrever, por isso a da manhã começa antes.

### 7. Período de teste e ida para o grupo oficial

- Tudo vai para o grupo de teste no início.
- Recomende 2 dias úteis seguidos sem falha antes de ir para o oficial.
- Só troque para o oficial quando a pessoa pedir com todas as letras. Use o modo PRODUÇÃO.

## Regras que valem sempre

- **Nunca invente número.** Todo dado vem de fonte consultada na hora. Sem fonte, a linha sai da mensagem.
- **Se uma fonte travar, a mensagem sai sem o trecho que depende dela.** Não tente contornar bloqueio de site.
- **Destinos fixos.** Cada Rotina só envia para os dois grupos do perfil. Nunca para outro número ou grupo.
- **Se o envio for bloqueado por permissão**, a Rotina para e reporta. Não tenta outro caminho.
- **Credenciais só em variável de ambiente**, nunca em prompt, arquivo, comando ou chat.
- Não coloque na mensagem nada que a pessoa não aprovou: produtos, parceiros, links e temas vêm só do perfil.

## Arquivos

- `references/entrevista.md`: perguntas da instalação e formato do `perfil.json`.
- `references/voz.md`: como transformar as amostras em guia de voz.
- `references/compliance.md`: aviso de responsabilidade e regras fixas de conteúdo.
- `references/ambiente.md`: variáveis, script de setup e permissão de envio.
- `references/dados.md`: fontes de dados por mercado e cuidados.
- `references/diagnostico.md`: o que checar quando uma mensagem não sai.
- `templates/`: modelos dos prompts das 3 Rotinas.
- `scripts/enviar.py`: envia texto, imagem e enquete pela Z-API.
- `scripts/listar_grupos.py`: lista os grupos do número conectado.
- `scripts/grafico.py`: gráfico do último pregão de mini índice e mini dólar (B3).
- `scripts/gerar_prompts.py`: monta os prompts finais a partir do perfil.
- `exemplos/perfil-exemplo.json`: perfil fictício para referência.
