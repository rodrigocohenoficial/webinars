import { db } from "@/lib/db";
import { grampearSegundo } from "@/lib/sala";

export const dynamic = "force-dynamic";

/**
 * O clique na oferta. Gravado com data e com o ponto do video — e o ponto
 * do video que permite medir a conversao sobre quem chegou ao minuto dela,
 * em vez de sobre o total.
 *
 * So o primeiro clique conta: quem clica tres vezes e uma pessoa, nao tres.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

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
      ctaClickedAt: true,
      session: { select: { startsAt: true, webinar: { select: { durationSec: true } } } },
    },
  });
  if (!inscricao) return new Response(null, { status: 404 });
  if (inscricao.ctaClickedAt) return new Response(null, { status: 204 });

  const agora = new Date();
  const ponto = grampearSegundo(sec, {
    inicioMs: inscricao.session.startsAt.getTime(),
    agoraMs: agora.getTime(),
    durationSec: inscricao.session.webinar.durationSec,
  });

  await db.registration.update({
    where: { id: inscricao.id },
    data: { ctaClickedAt: agora, ctaClickedAtSec: ponto },
  });

  return new Response(null, { status: 204 });
}
