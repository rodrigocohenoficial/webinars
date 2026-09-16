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

**Precisa de um domínio seu.** Se você ainda não tem, pule esta parte e volte depois —
o sistema roda sem.

1. Abra **resend.com**, crie conta.
2. Menu **Domains** → **Add Domain** → digite seu domínio (ex: `tradernation.com.br`).
3. Ele mostra **3 ou 4 registros de DNS** (uns códigos em tabela).
4. Esses registros precisam ser colados no painel onde seu domínio está registrado —
   Registro.br, Cloudflare, GoDaddy, HostGator, o que for. **Se você não cuida do seu
   domínio, manda essa tela para quem cuida.** É o único passo deste guia que talvez
   não seja você quem faz.
5. Volte no Resend e clique em **Verify**. Pode levar de 5 minutos a algumas horas.
   Quando ficar verde, siga.
6. Menu **API Keys** → **Create API Key** → copie o código (começa com `re_`).
7. Vá na **Vercel** → seu projeto → **Settings** → **Environment Variables** e
   adicione duas:

| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | o código que começa com `re_` |
| `RESEND_FROM_EMAIL` | `Rodrigo Cohen <webinario@seudominio.com.br>` |

8. **Deployments** → nos três pontinhos do último deploy → **Redeploy**.

Teste: inscreva-se você mesmo na sua página. O e-mail de confirmação tem que chegar
em segundos.

---

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

1. **Vercel** → seu projeto → **Settings** → **Domains** → **Add**.
2. Digite `webinario.seudominio.com.br`.
3. Ele mostra um registro **CNAME**. Cole no painel do seu domínio, igual à parte 4.
4. Quando ficar verde, volte em **Environment Variables** e mude
   `NEXT_PUBLIC_SITE_URL` para `https://webinario.seudominio.com.br`.
5. **Redeploy.** Esse último passo é obrigatório — é essa variável que monta os links
   que vão nos e-mails.

---

## Quando algo der errado

| O que você vê | O que é |
|---|---|
| O deploy falhou dizendo `Can't reach database server` | `DATABASE_URL` errada ou incompleta. Copie de novo do Neon. |
| "Senha incorreta" no painel, com a senha certa | `ADMIN_PASSWORD` não foi salva, ou faltou Redeploy. |
| O link do e-mail abre a página errada | `NEXT_PUBLIC_SITE_URL` desatualizada. Corrija e Redeploy. |
| Confirmação chega, lembrete não | O agendador não está rodando. Veja a parte 3. |
| Nenhum e-mail chega | Domínio não verificado no Resend, ou faltou Redeploy. |
| O agendador mostra 401 | O `secret=` da URL está diferente do `CRON_SECRET` da Vercel. |
| Mudei algo e nada mudou | Redeploy. É quase sempre isso. |

---

## Depois que estiver no ar

Volte para o **COMO-RODAR.md**. Ele te leva do painel vazio até a primeira sessão com
gente dentro: onde entra o vídeo, como escrever o roteiro do chat, em que minuto pôr a
oferta.
