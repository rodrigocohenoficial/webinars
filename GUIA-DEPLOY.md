# Colocar no ar — clique a clique

Para quem nunca fez isso. Nenhum passo aqui precisa de terminal, de programar nem de
saber o que é um servidor. É tudo apontar e clicar em site.

**Tempo:** 20 minutos para estar no ar. As partes 4 e 5 (e-mail e WhatsApp) podem
esperar — o sistema funciona sem elas, só não dispara mensagem.

**Custo:** R$ 0 para as partes 1 a 3.

> **A regra que salva 90% dos problemas:** toda vez que você mudar ou adicionar uma
> variável na Vercel, precisa clicar em **Redeploy**. Variável nova não vale sozinha.
> Se algo parar de funcionar, a primeira pergunta é: eu fiz Redeploy?

---

## Antes de começar: abra um bloco de notas

Você vai gerar alguns códigos e precisa colar eles depois. Deixe um bloco de notas
aberto e vá anotando.

**Dois deles você inventa agora.** São senhas que ninguém nunca vê — nem você precisa
decorar. Aperte teclas aleatórias, umas 40, sem espaço. Duas vezes, dois códigos
diferentes:

```
AUTH_SECRET   → kj2h4kjh23kjh42kj3h4k2j3h4k2j3h4kj23h4k2j3
CRON_SECRET   → 98a7sd98a7sd98a7sd98as7d98as7d9a8s7d9a8s7
```

Anote também a senha que você quer usar para entrar no painel. Essa você vai digitar,
então escolha uma que lembre — e que não seja a mesma de outro lugar.

```
ADMIN_PASSWORD → (a senha do seu painel)
```

---

## Parte 1 — O banco de dados (5 minutos, grátis)

É onde ficam os inscritos, os comentários e as métricas.

1. Abra **neon.tech** e clique em **Sign up**.
2. Escolha **Continue with GitHub** e autorize.
3. Ele pede para criar um projeto. Nome: `webinars`. A região pode deixar como vier.
4. Clique em **Create**.
5. A tela seguinte mostra uma caixa chamada **Connection string**, com um texto longo
   começando em `postgresql://`. Clique no ícone de copiar.
6. Cole no seu bloco de notas, marcado assim:

```
DATABASE_URL → postgresql://...(o texto longo que você copiou)
```

Pronto. Não precisa mexer em mais nada no Neon.

---

## Parte 2 — Colocar o site no ar (10 minutos, grátis)

1. Abra **vercel.com** e clique em **Sign Up**.
2. Escolha **Continue with GitHub** e autorize.
3. No painel da Vercel, clique em **Add New...** → **Project**.
4. Vai aparecer a lista dos seus repositórios do GitHub. Encontre **webinars** e
   clique em **Import**.
5. **PARE antes de clicar em Deploy.** Na mesma tela, procure a seção
   **Environment Variables** e clique para abrir.
6. Adicione **cinco** variáveis, uma por vez (nome à esquerda, valor à direita):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | o texto longo que você copiou do Neon |
| `AUTH_SECRET` | o primeiro código aleatório que você inventou |
| `ADMIN_PASSWORD` | a senha do seu painel |
| `CRON_SECRET` | o segundo código aleatório |
| `NEXT_PUBLIC_SITE_URL` | `https://webinars.vercel.app` — veja o aviso abaixo |

> **Sobre a última:** no alto da tela a Vercel mostra o nome que ela deu ao projeto.
> Seu endereço será esse nome + `.vercel.app`. Se o nome for `webinars-abc123`, o
> valor é `https://webinars-abc123.vercel.app`. Se errar, dá para corrigir depois —
> só lembre de fazer Redeploy.

7. Agora sim: **Deploy**. Leva uns 2 minutos.
8. Quando terminar, ele mostra o endereço do site. **Anote.**
9. Abra `SEU-ENDERECO/painel`. Vai aparecer uma tela pedindo senha. Digite a sua.

**Se entrou no painel, o sistema está no ar.** Você já pode criar um webinário,
configurar e receber inscrições.

---

## Parte 3 — O agendador (5 minutos, grátis)

É quem acorda o sistema de minuto em minuto para conferir quem precisa receber
lembrete, aviso de início e convite de remarcar.

Sem ele, a **confirmação da inscrição ainda sai** (ela é disparada na hora), mas os
outros três avisos não.

1. Abra **cron-job.org** e crie uma conta grátis.
2. Clique em **Create cronjob**.
3. **Title:** `webinario`
4. **URL:** cole isto, trocando as duas partes maiúsculas:

```
https://SEU-ENDERECO/api/cron?secret=SEU_CRON_SECRET
```

Exemplo real: `https://webinars-abc123.vercel.app/api/cron?secret=98a7sd98a7sd...`

5. Em **Execution schedule**, escolha **Every 1 minute(s)**.
6. **Create**.
7. Espere um minuto e olhe a coluna de status. Tem que aparecer **200** ou um
   certinho verde. Se aparecer **401**, o `CRON_SECRET` da URL está diferente do que
   você pôs na Vercel.

> **Se você tiver Vercel Pro**, dá para usar o agendador da própria Vercel em vez
> deste site: crie um arquivo `vercel.json` na raiz do repositório com
> `{"crons":[{"path":"/api/cron","schedule":"* * * * *"}]}`. No plano grátis da
> Vercel isso não funciona — ela só permite uma vez por dia. Por isso o padrão aqui é
> o cron-job.org.

---

## Parte 4 — E-mail (20 minutos, grátis até 3.000/mês)

Esta é a única parte do guia que fala de uma coisa invisível. Por isso ela confunde.
Leia a explicação antes de clicar em nada — depois os passos ficam óbvios.

### Por que este passo existe

E-mail foi inventado como carta com remetente escrito à mão: **qualquer um pode
escrever qualquer remetente no envelope.** Se o sistema simplesmente mandar um e-mail
dizendo "sou do tradernation.com.br", o Gmail não tem motivo nenhum para acreditar. Ele
joga no spam, ou recusa.

O que você vai fazer aqui é deixar um recado público, pendurado no seu domínio, dizendo:
*"eu autorizo o Resend a mandar e-mail em meu nome"*. O Gmail vai lá conferir esse
recado antes de entregar. É só isso.

### O que é DNS, sem termo técnico

É a lista telefônica do seu domínio. Quando alguém digita `tradernation.com.br`, o
computador consulta essa lista para saber onde o site mora.

Na mesma lista dá para pendurar **bilhetes de texto**. É isso que o Resend te pede: três
bilhetes.

> Adicionar bilhete nessa lista **não mexe no seu site, não mexe no e-mail que você já
> usa, e não derruba nada.** São linhas novas numa lista que já existe. Se você errar,
> nada quebra: o Resend simplesmente não verifica e você corrige.

### Onde fica essa lista

**Não é no Resend e não é na Vercel.** É onde seu domínio está registrado ou apontado:
Registro.br, Cloudflare, GoDaddy, Hostinger, HostGator, Locaweb. Um desses.

Se você não sabe qual é, quem cuida do seu site sabe na hora.

### Qual domínio usar — e por que num subdomínio

Use o domínio da marca onde a pessoa vai comprar. Se o webinário vende produto da
Trader Nation, o remetente é `tradernation.com.br`. Remetente de um domínio e link de
outro derruba confiança e levanta suspeita em filtro de spam.

Mas **não use o domínio raiz. Use um subdomínio:**

```
envio.tradernation.com.br
```

O motivo é reputação. Se um dia uma lista vier fria e muita gente marcar como spam, o
estrago fica preso nesse subdomínio e **não contamina o e-mail principal da empresa** —
contrato, suporte, cobrança continuam entregando normalmente. É a única razão, e é
suficiente. Não custa nada a mais: no Resend você digita `envio.tradernation.com.br` em
vez de `tradernation.com.br`, e o resto é igual.

O nome que aparece para quem recebe é o que você põe na frente, não o domínio:

```
RESEND_FROM_EMAIL = Rodrigo Cohen <webinario@envio.tradernation.com.br>
```

A pessoa vê **Rodrigo Cohen**. O domínio fica escondido.

### Os passos

1. Crie conta em **resend.com**.
2. Menu **Domains** → **Add Domain** → digite `envio.seudominio.com.br`.
3. Ele mostra uma tabela com **três linhas**. Cada linha tem três colunas:
   **Type** (tipo), **Name** (nome) e **Value** (valor).
4. Abra o painel onde seu domínio está registrado, procure **DNS** ou **Zona DNS**, e
   crie **três registros novos**, copiando coluna por coluna. É cópia e cola, nada mais.

   O que cada um faz, para você não achar que está fazendo mágica:

   | Bilhete | O que ele diz |
   |---|---|
   | SPF | "o Resend tem permissão de mandar e-mail por mim" |
   | DKIM | uma assinatura que carimba cada e-mail e prova que ninguém adulterou no caminho |
   | DMARC | o que fazer com quem tentar se passar por você |

5. Volte no Resend e clique em **Verify**.

### As três pegadinhas — é aqui que todo mundo trava

**1. O campo Name quase sempre engana.** Muitos painéis já completam o domínio sozinhos.
Se o Resend manda pôr `send.envio.tradernation.com.br` e o painel já mostra
`.tradernation.com.br` cinza do lado do campo, você digita **só `send.envio`**. Colar
inteiro cria `send.envio.tradernation.com.br.tradernation.com.br` — e nunca verifica.

> Esse é o erro número um, de longe. Se não verificar, olhe o campo Name primeiro.

**2. O campo Value tem que ir inteiro.** Use o botão de copiar do Resend, não selecione
com o mouse. Sem espaço sobrando no fim, sem quebra de linha no meio.

**3. Demora.** De 5 minutos a algumas horas para a lista se espalhar pelo mundo. Se
ainda não ficou verde, **não é você que errou.** Vá tomar um café e clique em Verify de
novo.

### Depois que ficar verde

6. Menu **API Keys** → **Create API Key** → copie o código (começa com `re_`).
7. Vá na **Vercel** → seu projeto → **Settings** → **Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | o código que começa com `re_` |
| `RESEND_FROM_EMAIL` | `Rodrigo Cohen <webinario@envio.seudominio.com.br>` |
| `RESEND_REPLY_TO` | o e-mail que você lê de verdade |

8. **Deployments** → três pontinhos do último deploy → **Redeploy**.

> **Sobre a caixa que não existe:** `webinario@envio.seudominio.com.br` **não precisa
> existir como caixa de entrada.** Você não vai criar e-mail nenhum — é só o nome que
> aparece no remetente. Mas alguém **vai** responder ("não consegui entrar", "o link não
> abre"), e essa é justamente a pessoa que precisa de resposta. É para isso que serve
> `RESEND_REPLY_TO`: a resposta cai na sua caixa de verdade.

### Como saber que deu certo

Inscreva-se você mesmo na sua página. O e-mail de confirmação chega em segundos.
Se chegou **na caixa de entrada e não no spam**, acabou.

### Se não quiser mexer nisso agora

Pule esta parte inteira. O sistema roda sem e-mail: a inscrição funciona, a sala
funciona, o chat, a oferta e as métricas funcionam. Você só não dispara os quatro
avisos. Dá para voltar aqui em qualquer dia, sem refazer nada.

## Parte 5 — WhatsApp (15 minutos, pago)

A Z-API custa por volta de R$ 100 por mês. É o que conecta um número de WhatsApp ao
sistema.

> **Use um número dedicado, nunca o seu pessoal.** Disparo automático por WhatsApp
> não é oficial da Meta, e número que dispara muito pode ser bloqueado. Chip novo,
> número só para isso.

1. Abra **z-api.io**, crie conta e assine uma instância.
2. Dentro da instância vai aparecer um **QR Code**. Abra o WhatsApp do número
   dedicado → Aparelhos conectados → Conectar aparelho → leia o QR.
3. Na mesma tela, copie três coisas:
   - **Instance ID**
   - **Token**
   - **Client-Token** (fica em Segurança / Account Security Token)
4. **Vercel** → **Settings** → **Environment Variables**, adicione três:

| Nome | Valor |
|---|---|
| `ZAPI_INSTANCE` | o Instance ID |
| `ZAPI_TOKEN` | o Token |
| `ZAPI_CLIENT_TOKEN` | o Client-Token |

5. **Redeploy.**

Teste: inscreva-se de novo com seu WhatsApp. A confirmação chega nos dois canais.

---

## Parte 6 — Seu domínio no lugar do .vercel.app (opcional)

> **Use um subdomínio diferente do que você verificou no Resend.** O site e o e-mail
> pedem registros de DNS diferentes no mesmo nome, e isso briga. Se o e-mail ficou em
> `envio.seudominio.com.br`, o site vai em `webinar.seudominio.com.br` — ou vice-versa.
> Nunca os dois no mesmo.

1. **Vercel** → seu projeto → **Settings** → **Domains** → **Add**.
2. Digite `webinar.seudominio.com.br`.
3. Ele mostra um registro **CNAME**. Cole no painel do seu domínio, igual à parte 4.
4. **Espere ficar verde na Vercel antes de seguir.** Se você mudar a variável abaixo
   antes do domínio funcionar, todo link que sair nos e-mails aponta para um endereço
   morto.
5. Ficou verde: volte em **Environment Variables** e mude `NEXT_PUBLIC_SITE_URL`.

   Duas coisas que travam gente aqui:

   **O valor precisa do `https://` na frente.** Não é `webinar.seudominio.com.br`, é:

   ```
   https://webinar.seudominio.com.br
   ```

   Sem barra no fim.

   **O Type tem que ser `Config`, não `Secret`.** A Vercel recusa marcar como Secret
   qualquer variável que comece com `NEXT_PUBLIC_`, e mostra um recado vermelho
   dizendo isso. Não é erro seu: `NEXT_PUBLIC_` significa, por definição, um valor que
   vai para o navegador de quem visita. É o endereço público do seu site — ele aparece
   na barra do navegador de qualquer visitante. Não há nada a esconder, e por isso
   `Config` é o certo.

   > As outras variáveis são o oposto: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`,
   > `CRON_SECRET`, `RESEND_API_KEY` e as três do WhatsApp **são segredo de verdade** e
   > devem ficar como `Secret`.

6. **Redeploy.** Esse último passo é obrigatório — é essa variável que monta os links
   que vão dentro dos e-mails.
7. Abra `https://webinar.seudominio.com.br/api/saude` e confirme que o endereço que
   aparece em `enderecoDoSite` é o novo, sem barra sobrando e com `https://`.

---

## Quando algo der errado

### Primeiro: abra `/api/saude` no seu site

O sistema se diagnostica sozinho. Abra `https://seu-endereco/api/saude` e ele responde,
em português, o que está faltando: se o banco responde, se as migrações rodaram, quais
variáveis estão configuradas e se o endereço do site tem erro de digitação.

Nenhum segredo aparece ali — só se cada variável está preenchida ou não.

### Se o site inteiro devolve 404

Não é a rota que está errada: **é que não existe nenhuma versão publicada.** Quando o
build falha, a Vercel não publica nada, e o endereço devolve 404 em tudo — `/painel`,
`/entrar`, `/api/cron`, tudo igual.

Para confirmar: abra `https://seu-endereco/painel`. Se der 404 também, é isto.

Onde ver o motivo: **Vercel → Deployments**. O deploy do topo vai estar vermelho, com
**Error**. Clique nele e role até o fim do log — a última mensagem diz o que aconteceu.

### Se o agendador devolve 404

Mesma coisa acima: o site não está publicado. **401** é outro problema — aí o site
existe e o segredo na URL é que está diferente do `CRON_SECRET` da Vercel.

| O que você vê | O que é |
|---|---|
| O deploy falhou dizendo `Can't reach database server` | `DATABASE_URL` errada ou incompleta. Copie de novo do Neon. |
| "Senha incorreta" no painel, com a senha certa | `ADMIN_PASSWORD` não foi salva, ou faltou Redeploy. |
| O link do e-mail abre a página errada | `NEXT_PUBLIC_SITE_URL` desatualizada. Corrija e Redeploy. |
| Confirmação chega, lembrete não | O agendador não está rodando. Veja a parte 3. |
| Nenhum e-mail chega | Domínio não verificado no Resend, ou faltou Redeploy. |
| O agendador mostra 401 | O `secret=` da URL está diferente do `CRON_SECRET` da Vercel. |
| O agendador devolve 404 | O site não está publicado. Veja acima. |
| O agendador devolve 401 | O segredo na URL está diferente do `CRON_SECRET`. |
| O agendador foi desativado sozinho | O cron-job.org desliga depois de muitas falhas seguidas. Resolva a causa e reative na conta dele. |
| "Remove the public framework prefix" ao salvar variável | Você marcou como `Secret` uma variável `NEXT_PUBLIC_`. Troque o Type para `Config`. |
| Mudei algo e nada mudou | Redeploy. É quase sempre isso. |

---

## Depois que estiver no ar

Volte para o **COMO-RODAR.md**. Ele te leva do painel vazio até a primeira sessão com
gente dentro: onde entra o vídeo, como escrever o roteiro do chat, em que minuto pôr a
oferta.
