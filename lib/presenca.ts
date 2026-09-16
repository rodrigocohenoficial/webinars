import { db } from "./db";
import { JANELA_PRESENCA_MS } from "./metricas";

/**
 * Armadilha 9.12: presenca e sinal recente, nao inscricao.
 *
 * "Quantos estao assistindo" e quem deu sinal nos ultimos 75 segundos — o
 * dobro da batida de 30s, mais uma folga. Quem fechou a aba some sozinho.
 */
export async function assistindoPorWebinar(
  webinarIds: string[],
): Promise<Map<string, number>> {
  if (webinarIds.length === 0) return new Map();

  const desde = new Date(Date.now() - JANELA_PRESENCA_MS);
  const recentes = await db.registration.findMany({
    where: {
      isHost: false, // 9.11
      lastSeenAt: { gte: desde },
      session: { webinarId: { in: webinarIds } },
    },
    select: { session: { select: { webinarId: true } } },
  });

  const mapa = new Map<string, number>();
  for (const r of recentes) {
    const id = r.session.webinarId;
    mapa.set(id, (mapa.get(id) ?? 0) + 1);
  }
  return mapa;
}

export async function assistindoPorSessao(webinarId: string): Promise<Map<string, number>> {
  const desde = new Date(Date.now() - JANELA_PRESENCA_MS);
  const recentes = await db.registration.findMany({
    where: { isHost: false, lastSeenAt: { gte: desde }, session: { webinarId } },
    select: { sessionId: true },
  });

  const mapa = new Map<string, number>();
  for (const r of recentes) mapa.set(r.sessionId, (mapa.get(r.sessionId) ?? 0) + 1);
  return mapa;
}
