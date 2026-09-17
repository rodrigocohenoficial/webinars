# Como rodar o seu primeiro webinário

Do zero até a primeira sessão com gente dentro. Cinco coisas: o vídeo, a captação,
os disparos, o chat e a oferta. Cada uma tem um lugar exato.

---

## Antes de tudo: subir o sistema

Se o sistema ainda não está no ar, comece pelo **[GUIA-DEPLOY.md](GUIA-DEPLOY.md)** —
é o clique a clique, sem terminal e sem programar, do zero até o painel abrindo.

Resumo do que ele faz: um banco no Neon, o site na Vercel com cinco variáveis, e um
agendador de minuto em minuto no cron-job.org. Vinte minutos, custo zero. E-mail e
WhatsApp entram depois, quando você quiser.

---

## 1. O vídeo

**Painel → Novo webinário → aba Configuração → seção Vídeo.**

Cole o link do YouTube ou do Vimeo e clique em **Detectar**. Ele lê a duração sozinho.

> **O sistema recusa salvar vídeo sem duração.** Não é frescura: sem duração a sessão
> nunca encerra e, passado o fim, o player pede um segundo que não existe e fica em
> branco — sem erro nenhum, só uma tela preta e a pessoa achando que travou. Se o
> provedor não responder, digite a duração a mão. `48:30` funciona.

**Vídeo não listado, nunca privado.** Privado o player não toca. Não listado não
aparece na busca do YouTube e toca normalmente.

Opcional, na mesma seção: **vídeo da sala de espera**. Roda em laço e mudo enquanto
a contagem regressiva corre. Um loop de 30 segundos da sua mesa já resolve.

---

## 2. Captar o lead

**Painel → Configuração → seção Publicação → ligar.**

A partir daí `seudominio.com.br/w/seu-slug` está no ar. Ela pede **nome, e-mail e
WhatsApp**, e é essa página que você manda no tráfego.

Antes, defina a grade: **Configuração → Grade de horários**. Por exemplo terça e
quinta às 20h. O sistema mostra os próximos horários calculados na hora — não existe
sessão vazia ocupando banco, ela só nasce quando alguém se inscreve nela.

Ligue também **"Começa em N minutos"** se quiser que quem cai na página agora não
precise esperar até terça. Converte mais, quase sempre.

**Onde o lead aparece depois:**

| Onde | O que tem |
|---|---|
| Sessões → ver inscritos | nome, e-mail, WhatsApp, se veio, até que minuto assistiu |
| Sessões → baixar CSV | a mesma lista, por sessão |
| Desempenho → baixar todos em CSV | tudo, com UTM e origem |
| Desempenho → Quem clicou na oferta | **a lista mais quente que o sistema produz** |

UTM é capturado sozinho. Mande `?utm_source=instagram&utm_campaign=reels-outubro` na
URL e a tela de Desempenho te diz a taxa de comparecimento por origem — não só quantos
se inscreveram, quantos **apareceram**. São coisas diferentes e a segunda é a que
importa.

Pixel da Meta: coloque `NEXT_PUBLIC_META_PIXEL_ID` e o evento `Lead` dispara na tela
de obrigado, com ID estável — recarregar a página não conta duas vezes.

---

## 3. Os disparos por e-mail e WhatsApp

Quatro momentos, automáticos, pelos dois canais:

| Quando | O que chega |
|---|---|
| Na hora da inscrição | Vaga confirmada, com o link pessoal |
| 15 minutos antes | Lembrete |
| No minuto que começa | "Começou agora" |
| 1 hora depois do fim | Convite para remarcar — **só para quem não entrou** |

**Para ligar:**

```
RESEND_API_KEY        conta no resend.com, domínio verificado
RESEND_FROM_EMAIL     Rodrigo Cohen <webinario@envio.seudominio.com.br>
RESEND_REPLY_TO       o e-mail que você lê de verdade
ZAPI_INSTANCE         painel da Z-API
ZAPI_TOKEN
ZAPI_CLIENT_TOKEN
```

O remetente é uma caixa que não existe — e-mail de sistema só sai, não recebe. Mas
alguém sempre responde "não consegui entrar", e é justamente quem mais precisa de
resposta. `RESEND_REPLY_TO` manda essa resposta para a sua caixa de verdade.

Sem essas variáveis o sistema roda inteiro e nada quebra — só não dispara nada.

**O que já está protegido, para você não precisar pensar nisso:**

- Quem se inscreveu faltando menos de 20 minutos **não recebe lembrete**. Receber
  "faltam 15 minutos" dois minutos depois de se inscrever é spam.
- O convite de remarcar tem teto de 6 horas. Sem esse teto, no dia em que você ligar
  os disparos, todo no-show da história do banco recebe convite de uma vez só.
- Webinário sem vídeo publicado **não dispara nada**. Levaria a pessoa a uma tela vazia.
- Um canal entregue já cumpre o aviso. Se os dois falharem, tenta de novo no minuto
  seguinte. Ninguém recebe a mesma mensagem duas vezes — a trava é um carimbo na
  inscrição, não a frequência do agendador.

O texto das mensagens está em `lib/mensagens.ts`. Mexa à vontade, mas **nenhuma delas
pode dizer "ao vivo", "vídeo", "gravação" ou "replay"**. O motivo está no fim deste
documento.

---

## 4. O chat — a parte que faz a sala não parecer vazia

**Painel → aba Roteiro.**

Cada comentário é preso a um **segundo do vídeo**, não a uma hora do relógio. É isso
que faz a coisa toda funcionar: quem assiste às 20h vê, aos 12 minutos de vídeo, o
comentário que alguém escreveu aos 12 minutos na sessão das 14h.

Escreva um a um, ou cole em lote no formato `nome | tempo | comentário`:

```
Marcia Rocha | 0:45 | cheguei agora, deu tempo?
Paulo H. | 2:10 | essa parte do risco eu nunca tinha ouvido assim
Ana Paula | 8:30 | opero WIN há 2 anos e nunca pensei nisso
```

Toda linha que não entrar volta com o motivo e o número dela. Não some nada em
silêncio.

**Quantos escrever:** 20 a 30 num vídeo de 45 minutos. Concentre nos **primeiros 90
segundos** — é ali que a pessoa decide se fica. Sala vazia nos primeiros 30 segundos
mata a sessão inteira.

**Comentário de participante nasce aguardando.** Você libera em **Curadoria**, e
liberar é aprovar: ele aparece para a sala e passa a fazer parte do replay das
próximas sessões. A sala vai ficando mais cheia sozinha, com gente de verdade.

**Chat ao vivo** (Configuração → Entrada): ligado, os participantes se veem na hora.
Desligado, só você vê e libera um por um. Comece desligado.

**Entrar na sua própria sala:** Sessões → "entrar na sala", num horário que está
rolando. É a mesma tela que eles veem, com duas coisas a mais: quantos estão
assistindo e em que minuto cada um está, e o botão de liberar em cada comentário.
Você escreve com selo de apresentador e o que você escreve entra no replay.

---

## 5. A oferta

**Painel → Configuração → seção Oferta.**

Quatro campos: texto do botão, link, a chamada acima do botão, e **em que minuto ela
aparece**.

O minuto é a decisão que mais pesa. Regra prática: depois da entrega principal, antes
da queda da curva. Você descobre onde é a queda em **Desempenho → Curva de retenção**
— a linha pontilhada é onde sua oferta está hoje. Se a queda vem antes da linha, a
oferta está tarde.

**A conversão é medida sobre quem chegou ao minuto dela**, não sobre o total de
inscritos. Medir sobre o total esconde uma oferta que converte bem mas aparece tarde
demais.

**"Repetir a oferta na tela de encerramento"** vem ligada. Quem ficou até o fim é o
lead mais quente que a sessão produz, e deixar o botão sumir junto com o vídeo joga
isso fora. Desligue só se sua oferta tiver escassez de minuto.

Só o primeiro clique de cada pessoa conta. O clique é gravado com data **e com o ponto
do vídeo** — você sabe em que minuto cada lead levantou a mão.

---

## Antes de abrir para o público

**Painel → aba Prévia.** Ela renderiza a sala de verdade em qualquer momento da
sessão, sem se inscrever e sem gravar nada. Passe por: 10 minutos antes, minuto 0,
minuto da oferta, e encerrada.

Confira com os próprios olhos:

- [ ] O vídeo começa sozinho e no minuto certo
- [ ] Se pedir "toque para ouvir", o som liga e **o vídeo não trava**
- [ ] Os primeiros segundos estão cobertos (a marca do YouTube não aparece)
- [ ] Os comentários do roteiro aparecem nos minutos que você marcou
- [ ] A oferta aparece no minuto certo, e de novo na tela de fim
- [ ] Inscreva-se você mesmo e confira que o e-mail e o zap chegaram

Depois faça uma sessão de teste real, com um horário só seu, do começo ao fim.

---

## A regra que não se quebra

**Nenhuma tela diz "ao vivo".** Diz "webinário online", que é verdade.

Não é escrúpulo de programador. Afirmar transmissão ao vivo sobre um vídeo gravado é
afirmação falsa sobre o produto, com risco jurídico real — e para você, que é CNPI e
embaixador de B3 e Santander, o custo de escorregar nisso não é uma multa, é a
credibilidade.

Isso vale também para o bolinha vermelha pulsando, o selo "LIVE", a capa de
compartilhamento e o texto do e-mail. O sistema foi construído já sem nenhum deles, e
tem teste que varre cada tela e cada mensagem procurando as palavras proibidas.

A entrega é honesta e continua funcionando: a pessoa se inscreveu para assistir, e ela
assiste, no horário que ela escolheu, com gente conversando do lado. Isso não é
mentira. É produto.
