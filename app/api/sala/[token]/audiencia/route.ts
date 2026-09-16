import { db } from "@/lib/db";
import { JANELA_PRESENCA_MS } from "@/lib/metricas";

export const dynamic = "force-dynamic";

/**
 * O que o apresentador ve da propria sala: quantos estao assistindo e, ao
 * clicar, quem sao, em que minuto cada um esta e quem ja clicou na oferta.
 *
 * So responde para quem entrou como apresentador.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const eu = await db.registration.findUnique({
    where: { token },
    select: { isHost: true, sessionId: true },
  });
  if (!eu) return Response.json({ erro: "nao encontrado" }, { status: 404 });
  if (!eu.isHost) return Response.json({ erro: "nao autorizado" }, { status: 403 });

  const desde = new Date(Date.now() - JANELA_PRESENCA_MS);

  // 9.11: o proprio apresentador fica fora da conta.
  const pessoas = await db.registration.findMany({
    where: { sessionId: eu.sessionId, isHost: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      lastSeenAt: true,
      watchedUntilSec: true,
      ctaClickedAt: true,
      firstSeenAt: true,
    },
  });

  const lista = pessoas.map((p) => ({
    id: p.id,
    nome: p.name,
    email: p.email,
    // 9.12: presenca e sinal recente, nao inscricao
    assistindo: Boolean(p.lastSeenAt && p.lastSeenAt >= desde),
    veio: p.firstSeenAt !== null,
    sec: p.watchedUntilSec,
    clicou: p.ctaClickedAt !== null,
  }));

  return Response.json(
    {
      assistindo: lista.filter((p) => p.assistindo).length,
      inscritos: lista.length,
      pessoas: lista,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
