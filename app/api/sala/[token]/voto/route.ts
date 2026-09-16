import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Regra 5.4: o voto so vale na enquete que esta no ar.
 *
 * Senao basta conhecer o identificador para votar numa enquete que a sessao
 * nem alcancou — e quem decide se ela esta no ar e o relogio do servidor
 * contra o inicio da sessao, nunca o cliente (5.2).
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const corpo = (await req.json().catch(() => null)) as
    | { pollId?: string; optionId?: string }
    | null;
  if (!corpo?.pollId || !corpo?.optionId) {
    return Response.json({ erro: "faltou enquete ou opcao" }, { status: 400 });
  }

  const inscricao = await db.registration.findUnique({
    where: { token },
    select: {
      id: true,
      isHost: true,
      sessionId: true,
      session: { select: { startsAt: true, webinarId: true } },
    },
  });
  if (!inscricao) return Response.json({ erro: "nao encontrado" }, { status: 404 });

  // 9.11: o apresentador nao vota, senao enviesa a propria apuracao.
  if (inscricao.isHost) return Response.json({ erro: "apresentador nao vota" }, { status: 403 });

  const enquete = await db.poll.findUnique({
    where: { id: corpo.pollId },
    include: { options: { select: { id: true } } },
  });
  if (!enquete || enquete.webinarId !== inscricao.session.webinarId) {
    return Response.json({ erro: "enquete nao e deste webinario" }, { status: 404 });
  }
  if (!enquete.options.some((o) => o.id === corpo.optionId)) {
    return Response.json({ erro: "essa opcao nao e desta enquete" }, { status: 400 });
  }

  const posicao = Math.floor((Date.now() - inscricao.session.startsAt.getTime()) / 1000);
  const noAr = posicao >= enquete.atSec && (enquete.untilSec === null || posicao < enquete.untilSec);
  if (!noAr) {
    return Response.json({ erro: "essa enquete nao esta no ar" }, { status: 409 });
  }

  // Um voto por pessoa, com direito a trocar.
  await db.pollVote.upsert({
    where: { pollId_registrationId: { pollId: enquete.id, registrationId: inscricao.id } },
    create: {
      pollId: enquete.id,
      optionId: corpo.optionId,
      registrationId: inscricao.id,
      sessionId: inscricao.sessionId,
    },
    update: { optionId: corpo.optionId },
  });

  return Response.json({ ok: true });
}
