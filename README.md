# Webinário automatizado

Um vídeo gravado entregue como transmissão marcada. A pessoa se inscreve, escolhe um
horário, recebe um link pessoal, e na hora marcada o vídeo começa sozinho, sincronizado
pelo relógio. Sem barra de progresso.

O que separa isso de um link de vídeo comum é o chat: **todo comentário é gravado com o
segundo do vídeo em que foi escrito, nunca com a hora do relógio.** É isso que permite
reapresentar o comentário no minuto exato na sessão seguinte.

O sistema nunca afirma "ao vivo" em nenhuma tela. Diz "webinário online", que é verdade.

## Rodar local

```bash
cp .env.example .env     # ajuste DATABASE_URL e ADMIN_PASSWORD
npm install
npx prisma migrate dev
npm run dev
```

Painel em `/painel` (senha = `ADMIN_PASSWORD`). Nenhuma integração é obrigatória: sem chave
de e-mail, sem credencial de WhatsApp e sem pixel o sistema inteiro roda e nada quebra.

## Um provider de banco só

Postgres em desenvolvimento e em produção. A especificação original usava SQLite em dev, e
a armadilha que isso gerou (schema e cliente gerado apontando para bancos diferentes) some
quando não há troca de provider.

## Estado da construção

- [x] 1. Modelo de dados e painel mínimo
- [x] 2. Página de inscrição e grade de horários
- [x] 3. A sala, fase LIVE
- [ ] 4. As outras três fases
- [ ] 5. Chat: roteiro e trilha do replay
- [ ] 6. Chat: comentários reais e curadoria
- [ ] 7. Presença e métricas
- [ ] 8. A oferta
- [ ] 9. Avisos automáticos
- [ ] 10. Replay individual
- [ ] 11. Apresentador na sala
- [ ] 12. Enquetes
