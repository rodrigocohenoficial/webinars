import { db } from "@/lib/db";
import { estaLogado } from "@/lib/admin";
import { montarCsv } from "@/lib/metricas";
import { formatMinutoSegundo, formatSlot } from "@/lib/time";
import { formatarTelefoneBR } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await estaLogado())) return new Response("nao autorizado", { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessao");
  const soCliques = url.searchParams.get("cliques") === "1";

  const inscritos = await db.registration.findMany({
    where: {
      // 9.11: o apresentador fica fora de TODA lista
      isHost: false,
      session: { webinarId: id, ...(sessionId ? { id: sessionId } : {}) },
      ...(soCliques ? { ctaClickedAt: { not: null } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { session: { select: { startsAt: true } } },
  });

  const csv = montarCsv(
    [
      "nome",
      "email",
      "whatsapp",
      "sessao",
      "inscrito em",
      "compareceu",
      "assistiu ate",
      "clicou na oferta",
      "clicou no minuto",
      "origem",
      "campanha",
      "referrer",
    ],
    inscritos.map((r) => [
      r.name,
      r.email,
      formatarTelefoneBR(r.phone),
      formatSlot(r.session.startsAt),
      formatSlot(r.createdAt),
      r.firstSeenAt ? "sim" : "nao",
      formatMinutoSegundo(r.watchedUntilSec),
      r.ctaClickedAt ? formatSlot(r.ctaClickedAt) : "",
      r.ctaClickedAtSec !== null ? formatMinutoSegundo(r.ctaClickedAtSec) : "",
      r.utmSource ?? "",
      r.utmCampaign ?? "",
      r.referrer ?? "",
    ]),
  );

  const nome = soCliques ? "cliques-na-oferta" : "inscritos";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}.csv"`,
      "cache-control": "no-store",
    },
  });
}
