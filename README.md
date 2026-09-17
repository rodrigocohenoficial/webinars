# Webinário automatizado

Um vídeo gravado entregue como transmissão marcada. A pessoa se inscreve, escolhe um
horário, recebe um link pessoal, e na hora marcada o vídeo começa sozinho, sincronizado
pelo relógio. Não há barra de progresso: não dá para adiantar, voltar nem pausar.

O que separa isso de um link de vídeo comum é o chat.

> **A regra que sustenta o sistema inteiro:** todo comentário é gravado com o **segundo do
> vídeo** em que foi escrito, nunca com a hora do relógio.

É isso que permite reapresentar o comentário no minuto exato na sessão seguinte. Quem assiste
às 20h vê, aos 12 minutos de vídeo, o comentário que alguém escreveu aos 12 minutos na sessão
das 14h. A sala fica cheia desde a primeira sessão e vai ficando mais cheia com o tempo,
sozinha.

**O sistema nunca afirma "ao vivo" em nenhuma tela ou imagem.** Diz "webinário online", que é
verdade. Afirmar transmissão ao vivo sobre um vídeo gravado é afirmação falsa sobre o produto,
com risco jurídico real.

---

## Rodar local

Precisa de Node 20+ e um Postgres.

```bash
cp .env.example .env         # ajuste DATABASE_URL e ADMIN_PASSWORD
npm install
npx prisma migrate dev
npm run dev
```

Painel em `/painel` (senha = `ADMIN_PASSWORD`).

**Nenhuma integração é obrigatória.** Sem chave de e-mail, sem credencial de WhatsApp e sem
pixel, o sistema inteiro roda e nada quebra. Isso não é elegância: é o que torna o
desenvolvimento local possível.

## Publicar

Clique a clique, sem terminal: [**GUIA-DEPLOY.md**](GUIA-DEPLOY.md).

Em resumo: hospedagem serverless (Vercel) + Postgres (Neon) + um agendador chamando
`/api/cron` de minuto em minuto, protegido por `CRON_SECRET`. As migrações rodam
sozinhas no build (`prisma migrate deploy`), então não há passo manual de banco.

Variáveis: veja `.env.example`. As obrigatórias são `DATABASE_URL`, `AUTH_SECRET`,
`ADMIN_PASSWORD`, `CRON_SECRET` e `NEXT_PUBLIC_SITE_URL`.

O plano grátis da Vercel só permite tarefa agendada uma vez por dia, e o sistema
precisa de uma por minuto. Por isso o agendador padrão é externo (cron-job.org, grátis).
Com Vercel Pro, dá para usar o agendador dela criando um `vercel.json` com
`{"crons":[{"path":"/api/cron","schedule":"* * * * *"}]}`.

## Um provider de banco só

Postgres em desenvolvimento e em produção. A especificação original usava SQLite em dev, e a
armadilha que isso gerou — schema e cliente gerado apontando para bancos diferentes — deixa de
existir quando não há troca de provider.

---

## Como usar

Já está no ar? Manual de operação, do deploy à primeira sessão com gente dentro:
[**COMO-RODAR.md**](COMO-RODAR.md).

## Telas

**Públicas**

| Rota | O que é |
|---|---|
| `/w/slug` | Inscrição, com os horários calculados na memória |
| `/obrigado/token` | Confirmação, link copiável, `.ics` e pixel de conversão |
| `/sala/token` | A sala, nas quatro fases |
| `/replay/token` | Porta de entrada do replay individual |

**Painel** (um administrador, uma senha, cookie assinado)

Configuração · Roteiro · Enquetes · Curadoria · Sessões · Desempenho · Prévia

## Diagnóstico

`/api/saude` responde, em português, o que está faltando: conexão com o banco, migrações
aplicadas, variáveis configuradas e erro de digitação no endereço do site. Nenhum valor de
segredo aparece — só se está preenchido.

As migrações rodam no build mas **não derrubam o build** (`scripts/migrar.mjs`): um
`DATABASE_URL` errado deixaria o projeto sem nenhuma versão publicada, e aí o domínio
devolve 404 em todas as páginas — um sintoma que não aponta para a causa. Assim o site
sobe e diz na própria tela o que faltou.

## Testes

```bash
npm i -D playwright
npm run dev          # em outro terminal
npm run smoke        # 13 suítes, ~120 afirmações
```

Detalhes e o que cada suíte prova: [`smoke/README.md`](smoke/README.md).

---

## O que está pronto

- [x] 1. Modelo de dados e painel mínimo
- [x] 2. Página de inscrição e grade de horários
- [x] 3. A sala, fase LIVE
- [x] 4. As outras três fases
- [x] 5. Chat: roteiro e trilha do replay
- [x] 6. Chat: comentários reais e curadoria
- [x] 7. Presença e métricas
- [x] 8. A oferta
- [x] 9. Avisos automáticos
- [x] 10. Replay individual
- [x] 11. Apresentador na sala
- [x] 12. Enquetes
- [x] Pré-visualização da sala em qualquer momento
- [x] Oferta repetida na tela de encerramento

## O que ainda precisa de uma conferida humana

A política de rede do ambiente onde isto foi construído bloqueia `youtube.com` e `vimeo.com`.
A sala foi verificada contra um dublê fiel da API oficial do YouTube — que recusa reprodução
automática com som e passa a permitir depois de um gesto real, que é o comportamento do
navegador que importa aqui. **A reprodução contra o provedor real ainda não foi vista rodando.**
Antes da primeira sessão pública, abra `/painel/w/<id>/previa` num navegador com rede e confira
os quatro pontos da etapa 3: começa sozinho, começa no minuto certo, a cortina cobre a marca do
provedor, e ativar o som não trava a reprodução.

O mesmo vale para o envio real de e-mail e WhatsApp: as regras dos quatro avisos foram
verificadas contra um servidor local no lugar dos provedores, mas as credenciais de verdade
nunca foram exercitadas.

## Fora de escopo

Não hospeda vídeo · não transmite ao vivo de verdade · não é multiusuário nem whitelabel ·
não processa pagamento · não tem aviso de cookies · não faz teste A/B · não envia SMS.
