import { db } from "@/lib/db";
import { registrarPresenca } from "@/lib/presenca";

export const dynamic = "force-dynamic";

/**
 * A batida de presenca avulsa. Durante a sessao ela viaja na consulta do chat
 * (lib/presenca.ts); esta rota fica para o beacon de quando a pessoa fecha ou
 * esconde a aba, que precisa sair mesmo com a pagina indo embora.
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

  await registrarPresenca(inscricao, sec);

  return new Response(null, { status: 204 });
}
