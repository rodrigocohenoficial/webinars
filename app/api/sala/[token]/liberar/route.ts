import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liberar e aprovar: o comentario aparece para todos e entra no replay das
 * proximas sessoes, no mesmo segundo do video em que foi escrito.
 *
 * Responde so depois de gravar. Armadilha 9.6: quem confirma e o servidor.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const eu = await db.registration.findUnique({
    where: { token },
    select: { isHost: true, sessionId: true },
  });
  if (!eu) return Response.json({ erro: "nao encontrado" }, { status: 404 });
  if (!eu.isHost) return Response.json({ erro: "nao autorizado" }, { status: 403 });

  const corpo = (await req.json().catch(() => null)) as
    | { id?: string; acao?: "liberar" | "ocultar" }
    | null;
  if (!corpo?.id) return Response.json({ erro: "sem id" }, { status: 400 });

  const alvo = await db.chatMessage.findUnique({
    where: { id: corpo.id },
    select: { sessionId: true },
  });
  if (!alvo || alvo.sessionId !== eu.sessionId) {
    return Response.json({ erro: "esse comentario nao e desta sessao" }, { status: 404 });
  }

  const status = corpo.acao === "ocultar" ? "HIDDEN" : "APPROVED";
  await db.chatMessage.update({ where: { id: corpo.id }, data: { status } });

  return Response.json({ ok: true, status });
}
