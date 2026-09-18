import { db } from "@/lib/db";
import { grampearSegundo } from "@/lib/sala";
import { JANELA_PRESENCA_MS } from "@/lib/metricas";
import { normalizarTexto } from "@/lib/texto";

export const dynamic = "force-dynamic";

const TAMANHO_MAXIMO = 500;
const MAXIMO_POR_PESSOA = 60;

async function carregar(token: string) {
  return db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: true } } },
  });
}

/**
 * A consulta periodica da sala. Em serverless nao usamos conexao
 * persistente: a funcao tem tempo de execucao limitado e SSE nao se
 * sustenta. Enquete e oferta viajam junto daqui (etapas 8 e 12) — cada dado
 * com endpoint proprio triplica a carga sem ganhar nada.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const inscricao = await carregar(token);
  if (!inscricao) return Response.json({ mensagens: [] }, { status: 404 });

  const { session } = inscricao;
  const w = session.webinar;

  // O que esta pessoa pode ver desta sessao:
  //  - sempre o que ela mesma escreveu, inclusive aguardando;
  //  - sempre o que o apresentador escreveu;
  //  - o que ja foi liberado (liberar e aprovar);
  //  - e, so com chat ao vivo ligado, o que os outros escreveram agora.
  const mensagens = await db.chatMessage.findMany({
    where: inscricao.isHost
      ? // O apresentador ve o chat inteiro, mesmo com o chat ao vivo
        // desligado — e dali que ele libera comentario para a sala.
        { sessionId: session.id, NOT: { status: "HIDDEN" } }
      : {
          sessionId: session.id,
          OR: [
            { registrationId: inscricao.id },
            { kind: "HOST" },
            { status: "APPROVED" },
            ...(w.chatAoVivo ? [{ kind: "REAL" as const, status: "PENDING" as const }] : []),
          ],
          NOT: { status: "HIDDEN" },
        },
    orderBy: [{ videoTimeSec: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      authorName: true,
      body: true,
      videoTimeSec: true,
      kind: true,
      status: true,
      registrationId: true,
    },
  });

  // A enquete ativa e decidida pelo relogio do servidor contra o inicio da
  // sessao — o cliente nao opina sobre qual esta no ar.
  const posicao = Math.floor((Date.now() - session.startsAt.getTime()) / 1000);
  const enqueteAtiva = await db.poll.findFirst({
    where: {
      webinarId: w.id,
      atSec: { lte: posicao },
      OR: [{ untilSec: null }, { untilSec: { gt: posicao } }],
    },
    orderBy: { atSec: "desc" },
    include: { options: { orderBy: { order: "asc" }, select: { id: true, label: true } } },
  });

  const meuVoto = enqueteAtiva
    ? await db.pollVote.findUnique({
        where: {
          pollId_registrationId: { pollId: enqueteAtiva.id, registrationId: inscricao.id },
        },
        select: { optionId: true },
      })
    : null;

  // Sem apuracao: a sala nao mostra resultado nem total. O unico dado que
  // volta daqui e em que opcao esta pessoa votou, para a escolha dela ficar
  // marcada.
  const enquete = enqueteAtiva
    ? {
        id: enqueteAtiva.id,
        pergunta: enqueteAtiva.question,
        meuVoto: meuVoto?.optionId ?? null,
        opcoes: enqueteAtiva.options.map((o) => ({ id: o.id, label: o.label })),
      }
    : null;

  /**
   * Quantos estao assistindo agora. E numero de verdade — quem deu sinal nos
   * ultimos 75 segundos (9.12) — e o apresentador fica fora dele (9.11).
   *
   * Abaixo do minimo, devolvemos null e a sala nao mostra nada. Nao e
   * inflar: e escolher nao anunciar uma sala de duas pessoas, que esvazia em
   * vez de encher.
   */
  let assistindo: number | null = null;
  if (w.mostrarAudiencia) {
    const desde = new Date(Date.now() - JANELA_PRESENCA_MS);
    const quantos = await db.registration.count({
      where: { sessionId: session.id, isHost: false, lastSeenAt: { gte: desde } },
    });
    assistindo = quantos >= w.audienciaMinima ? quantos : null;
  }

  // Secao 10: enquete e oferta viajam junto do chat, na mesma consulta.
  // Cada dado com endpoint proprio triplica a carga sem ganhar nada.
  const oferta =
    w.ctaUrl && w.ctaAtSec !== null
      ? {
          label: w.ctaLabel ?? "Quero saber mais",
          url: w.ctaUrl,
          descricao: w.ctaDescription,
          atSec: w.ctaAtSec,
          untilSec: w.ctaUntilSec,
        }
      : null;

  return Response.json(
    {
      oferta,
      enquete,
      assistindo,
      mensagens: mensagens.map((m) => ({
        id: m.id,
        autor: m.authorName,
        texto: m.body,
        sec: m.videoTimeSec,
        kind: m.kind,
        minha: m.registrationId === inscricao.id,
        aguardando: m.status === "PENDING",
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const inscricao = await carregar(token);
  if (!inscricao) return Response.json({ erro: "nao encontrado" }, { status: 404 });

  const { session } = inscricao;
  const w = session.webinar;

  const corpo = (await req.json().catch(() => null)) as { texto?: string; sec?: number } | null;
  const texto = normalizarTexto(String(corpo?.texto ?? "")).slice(0, TAMANHO_MAXIMO);
  if (!texto) return Response.json({ erro: "vazio" }, { status: 400 });

  const quantos = await db.chatMessage.count({
    where: { registrationId: inscricao.id },
  });
  if (quantos >= MAXIMO_POR_PESSOA) {
    return Response.json({ erro: "muitas mensagens" }, { status: 429 });
  }

  // Regra 5.2: o relogio do servidor manda.
  const videoTimeSec = grampearSegundo(corpo?.sec, {
    inicioMs: session.startsAt.getTime(),
    agoraMs: Date.now(),
    durationSec: w.durationSec,
  });

  // O apresentador escreve com selo e ja aprovado: vai direto para a sala e
  // para o replay das sessoes futuras. Participante nasce aguardando.
  const doApresentador = inscricao.isHost;

  const criada = await db.chatMessage.create({
    data: {
      webinarId: w.id,
      sessionId: session.id,
      registrationId: inscricao.id,
      authorName: inscricao.name,
      body: texto,
      videoTimeSec,
      kind: doApresentador ? "HOST" : "REAL",
      status: doApresentador ? "APPROVED" : "PENDING",
    },
    select: { id: true, authorName: true, body: true, videoTimeSec: true, kind: true, status: true },
  });

  return Response.json({
    mensagem: {
      id: criada.id,
      autor: criada.authorName,
      texto: criada.body,
      sec: criada.videoTimeSec,
      kind: criada.kind,
      minha: true,
      aguardando: criada.status === "PENDING",
    },
  });
}
