import { db } from "@/lib/db";
import { grampearSegundo } from "@/lib/sala";
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
