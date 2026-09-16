/**
 * As quatro fases da sala, decididas pelo relogio contra o inicio da sessao.
 * Funcao pura: o servidor usa para a primeira pintura, o cliente usa a cada
 * segundo com o relogio ja corrigido.
 */

export type Fase = "SEM_VIDEO" | "WAITING" | "LIVE" | "LATE" | "ENDED";

export type EstadoSala = {
  fase: Fase;
  /** segundo do video em que a sessao esta agora (negativo antes de comecar) */
  posicaoSec: number;
  /** segundos que faltam para comecar, quando esta esperando */
  faltamSec: number;
  /** segundos que faltam para acabar */
  restanteSec: number;
};

export function calcularEstado(opcoes: {
  agoraMs: number;
  inicioMs: number;
  durationSec: number | null;
  joinWindowMin: number;
  temVideo: boolean;
  /** quem ja entrou nao e mais expulso pela janela de entrada */
  jaEntrou?: boolean;
}): EstadoSala {
  const { agoraMs, inicioMs, durationSec, joinWindowMin, temVideo, jaEntrou } = opcoes;

  const decorridoSec = (agoraMs - inicioMs) / 1000;
  const duracao = durationSec ?? 0;
  const base = {
    posicaoSec: decorridoSec,
    faltamSec: Math.max(0, -decorridoSec),
    restanteSec: Math.max(0, duracao - decorridoSec),
  };

  // Invariante 5.1: sem duracao a sessao nunca encerraria. Aqui isso vira
  // uma tela honesta em vez de um player em branco.
  if (!temVideo || !durationSec) return { ...base, fase: "SEM_VIDEO" };

  if (decorridoSec < 0) return { ...base, fase: "WAITING" };
  if (decorridoSec >= durationSec) return { ...base, fase: "ENDED" };
  if (!jaEntrou && joinWindowMin > 0 && decorridoSec > joinWindowMin * 60) {
    return { ...base, fase: "LATE" };
  }
  return { ...base, fase: "LIVE" };
}

/**
 * Regra 5.2: o cliente manda o segundo do video em tres lugares — comentario,
 * presenca e voto — e nos tres o servidor grampeia o valor contra o ponto que
 * a sessao realmente alcancou.
 *
 * Sem isto, uma aba adiantada infla a retencao e qualquer um planta
 * comentario num ponto que ainda nao aconteceu.
 */
export function grampearSegundo(
  enviado: unknown,
  opcoes: { inicioMs: number; agoraMs: number; durationSec: number | null },
): number {
  const alcancado = Math.floor((opcoes.agoraMs - opcoes.inicioMs) / 1000);
  const teto = opcoes.durationSec
    ? Math.min(alcancado, opcoes.durationSec - 1)
    : alcancado;

  const n = typeof enviado === "number" ? enviado : Number(enviado);
  if (!Number.isFinite(n)) return Math.max(0, teto);

  return Math.max(0, Math.min(Math.floor(n), Math.max(0, teto)));
}
