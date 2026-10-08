import { db } from "./db";
import { JANELA_PRESENCA_MS } from "./metricas";
import { grampearSegundo } from "./sala";

/**
 * A batida de presenca. Grava lastSeenAt e o ponto mais avancado alcancado —
 * so o maximo, nunca cada batida. E o suficiente para a curva inteira e
 * evita uma tabela de eventos que cresce sem limite.
 *
 * Regra 5.2 tambem aqui: o segundo enviado e grampeado contra o ponto que a
 * sessao realmente alcancou, senao uma aba adiantada infla a retencao.
 *
 * Quem chama: a consulta periodica do chat (que ja carrega a inscricao, entao
 * a batida sai sem invocacao propria) e o beacon de saida da sala.
 */
export async function registrarPresenca(
  inscricao: {
    id: string;
    firstSeenAt: Date | null;
    watchedUntilSec: number;
    session: { startsAt: Date; webinar: { durationSec: number | null } };
  },
  sec: unknown,
): Promise<void> {
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
}

/**
 * Armadilha 9.12: presenca e sinal recente, nao inscricao.
 *
 * "Quantos estao assistindo" e quem deu sinal nos ultimos 75 segundos. A
 * batida vem a cada 10s com a consulta do chat, entao sobra folga para
 * algumas perdidas. Quem fechou a aba some sozinho.
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
