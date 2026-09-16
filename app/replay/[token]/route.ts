import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { novoToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Replay individual.
 *
 * Cria uma sessao comecando no instante em que a pessoa abre e manda para a
 * sala de sempre. Nao existe "modo replay": ele herda tudo sem duplicacao de
 * codigo — chat acumulado, oferta no minuto certo e metricas de retencao.
 *
 * Reabrir o mesmo link durante a exibicao devolve a sessao em curso em vez de
 * recomecar do zero.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const original = await db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: true } } },
  });
  if (!original) redirect("/");

  const w = original.session.webinar;

  // Sem video publicado, a sala ja tem o recado certo. Nao criamos sessao
  // nenhuma para levar a pessoa a um quadro vazio.
  if (!w.published || !w.videoUrl || !w.durationSec) redirect(`/sala/${original.token}`);

  // A cadeia nao cresce: todo replay aponta para a inscricao de origem.
  const raizId = original.replayOfId ?? original.id;

  const emCurso = await db.registration.findFirst({
    where: {
      replayOfId: raizId,
      session: {
        kind: "REPLAY",
        startsAt: { gt: new Date(Date.now() - (w.durationSec ?? 0) * 1000) },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (emCurso) redirect(`/sala/${emCurso.token}`);

  const agora = new Date();
  const sessao = await db.session.create({
    data: {
      webinarId: w.id,
      startsAt: agora,
      kind: "REPLAY",
      ruleKey: `replay:${raizId}:${agora.getTime()}`,
    },
    select: { id: true },
  });

  const nova = await db.registration.create({
    data: {
      sessionId: sessao.id,
      name: original.name,
      email: original.email,
      phone: original.phone,
      token: novoToken(),
      replayOfId: raizId,
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      referrer: original.referrer,
    },
    select: { token: true },
  });

  redirect(`/sala/${nova.token}`);
}
