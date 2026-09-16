import { db } from "@/lib/db";
import { formatSlotLongo } from "@/lib/time";
import { proximosSlots } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/**
 * Os proximos horarios, calculados agora. A sala busca isto quando precisa
 * mostrar reinscricao — armadilha 9.12: numero renderizado no servidor e
 * congelado mente, e uma aba aberta ha horas mostraria horarios que ja
 * passaram.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const inscricao = await db.registration.findUnique({
    where: { token },
    select: { session: { select: { webinar: { select: { id: true, jitEnabled: true, jitDelayMin: true, visibleSlots: true, published: true } } } } },
  });
  if (!inscricao) return Response.json({ slots: [] }, { status: 404 });

  const w = inscricao.session.webinar;
  if (!w.published) return Response.json({ slots: [] });

  const rules = await db.scheduleRule.findMany({ where: { webinarId: w.id } });
  const slots = proximosSlots(rules, new Date(), w.visibleSlots).map((s) => ({
    valor: String(s.startsAt.getTime()),
    label: formatSlotLongo(s.startsAt),
  }));

  if (w.jitEnabled) {
    slots.unshift({ valor: "jit", label: `Comeca em ${w.jitDelayMin} minutos` });
  }

  return Response.json(
    { slots },
    { headers: { "cache-control": "no-store" } },
  );
}
