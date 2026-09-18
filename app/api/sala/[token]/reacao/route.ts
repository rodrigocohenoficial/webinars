import { db } from "@/lib/db";
import { grampearSegundo } from "@/lib/sala";
import { reacaoValida } from "@/lib/reacoes";

export const dynamic = "force-dynamic";

/** Quantas reacoes uma pessoa pode mandar numa sessao. */
const MAXIMO_POR_PESSOA = 60;

/**
 * Uma reacao rapida. Presa ao segundo do video, como tudo aqui — e por isso
 * ela reaparece no mesmo minuto nas sessoes seguintes.
 *
 * Regra 5.2 tambem vale: o segundo enviado pelo cliente e grampeado contra o
 * ponto que a sessao realmente alcancou.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const corpo = (await req.json().catch(() => null)) as { emoji?: unknown; sec?: unknown } | null;
  if (!reacaoValida(corpo?.emoji)) {
    return Response.json({ erro: "reacao nao permitida" }, { status: 400 });
  }

  const inscricao = await db.registration.findUnique({
    where: { token },
    select: {
      id: true,
      isHost: true,
      sessionId: true,
      session: {
        select: { startsAt: true, webinarId: true, webinar: { select: { durationSec: true } } },
      },
    },
  });
  if (!inscricao) return Response.json({ erro: "nao encontrado" }, { status: 404 });

  const quantas = await db.reacao.count({ where: { registrationId: inscricao.id } });
  if (quantas >= MAXIMO_POR_PESSOA) return new Response(null, { status: 204 });

  const videoTimeSec = grampearSegundo(corpo?.sec, {
    inicioMs: inscricao.session.startsAt.getTime(),
    agoraMs: Date.now(),
    durationSec: inscricao.session.webinar.durationSec,
  });

  const criada = await db.reacao.create({
    data: {
      webinarId: inscricao.session.webinarId,
      sessionId: inscricao.sessionId,
      registrationId: inscricao.id,
      emoji: corpo.emoji,
      videoTimeSec,
    },
    select: { id: true, emoji: true, videoTimeSec: true },
  });

  return Response.json({
    reacao: { id: criada.id, emoji: criada.emoji, sec: criada.videoTimeSec },
  });
}
