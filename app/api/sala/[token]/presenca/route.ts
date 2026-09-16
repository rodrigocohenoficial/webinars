import { db } from "@/lib/db";
import { grampearSegundo } from "@/lib/sala";

export const dynamic = "force-dynamic";

/**
 * A batida de presenca. Grava lastSeenAt e o ponto mais avancado alcancado —
 * so o maximo, nunca cada batida. E o suficiente para a curva inteira e
 * evita uma tabela de eventos que cresce sem limite.
 *
 * Regra 5.2 tambem aqui: o segundo enviado e grampeado contra o ponto que a
 * sessao realmente alcancou, senao uma aba adiantada infla a retencao.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // sendBeacon manda texto puro, fetch manda json: aceitamos os dois
  const bruto = await req.text().catch(() => "");
  let sec: unknown = 0;
  try {
    sec = (JSON.parse(bruto || "{}") as { sec?: unknown }).sec;
  } catch {
    sec = Number(bruto);
  }

  const inscricao = await db.registration.findUnique({
    where: { token },
    select: {
      id: true,
      firstSeenAt: true,
      watchedUntilSec: true,
      session: { select: { startsAt: true, webinar: { select: { durationSec: true } } } },
    },
  });
  if (!inscricao) return new Response(null, { status: 404 });

  const agora = new Date();
  const ponto = grampearSegundo(sec, {
    inicioMs: inscricao.session.startsAt.getTime(),
    agoraMs: agora.getTime(),
    durationSec: inscricao.session.webinar.durationSec,
  });

  await db.registration.update({
    where: { id: inscricao.id },
    data: {
      lastSeenAt: agora,
      firstSeenAt: inscricao.firstSeenAt ?? agora,
      watchedUntilSec: Math.max(inscricao.watchedUntilSec, ponto),
    },
  });

  return new Response(null, { status: 204 });
}
