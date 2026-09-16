/**
 * Metricas. Tudo aqui e funcao pura: quem consulta o banco e a tela.
 *
 * Regra que vale em toda consulta de audiencia: o registro isHost fica fora.
 * Armadilha 9.11 — esqueca um lugar e o numero fica errado so ali, que e
 * pior do que estar errado em todos.
 */

/** Presenca e sinal recente, nao inscricao: o dobro da batida de 30s, mais folga. */
export const JANELA_PRESENCA_MS = 75000;

export const PONTOS_CURVA = 40;

export type Assistente = {
  watchedUntilSec: number;
  firstSeenAt: Date | null;
  ctaClickedAt?: Date | null;
};

export type PontoCurva = {
  sec: number;
  quantos: number;
  percentual: number;
};

export function compareceram<T extends { firstSeenAt: Date | null }>(pessoas: T[]): T[] {
  return pessoas.filter((p) => p.firstSeenAt !== null);
}

/**
 * Curva de retencao em 40 pontos: para cada trecho do video, quantos ainda
 * estavam la. Guardamos so o ponto maximo alcancado por pessoa, e isso basta
 * para a curva inteira.
 */
export function curvaRetencao(
  pessoas: Assistente[],
  durationSec: number | null,
  pontos = PONTOS_CURVA,
): PontoCurva[] {
  if (!durationSec || durationSec <= 0) return [];
  const presentes = compareceram(pessoas);
  const base = presentes.length;

  return Array.from({ length: pontos }, (_, i) => {
    const sec = Math.round((i / pontos) * durationSec);
    const quantos = presentes.filter((p) => p.watchedUntilSec >= sec).length;
    return { sec, quantos, percentual: base === 0 ? 0 : (quantos / base) * 100 };
  });
}

export function tempoMedioSec(pessoas: Assistente[]): number {
  const presentes = compareceram(pessoas);
  if (presentes.length === 0) return 0;
  return presentes.reduce((s, p) => s + p.watchedUntilSec, 0) / presentes.length;
}

/**
 * A conversao da oferta e medida sobre quem chegou ao minuto dela, nao sobre
 * o total. Medir sobre o total esconde uma oferta que converte bem mas
 * aparece tarde demais.
 */
export function conversaoDaOferta(
  pessoas: Assistente[],
  ctaAtSec: number | null,
): { chegaram: number; clicaram: number; taxa: number } {
  if (ctaAtSec === null) return { chegaram: 0, clicaram: 0, taxa: 0 };
  const presentes = compareceram(pessoas);
  const chegaram = presentes.filter((p) => p.watchedUntilSec >= ctaAtSec).length;
  const clicaram = presentes.filter((p) => p.ctaClickedAt).length;
  return { chegaram, clicaram, taxa: chegaram === 0 ? 0 : (clicaram / chegaram) * 100 };
}

export type Origem = {
  chave: string;
  inscritos: number;
  compareceram: number;
  taxa: number;
};

function dominio(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** utm_source + campanha, senao o dominio de origem, senao "direto". */
export function agruparOrigem(
  pessoas: {
    utmSource: string | null;
    utmCampaign: string | null;
    referrer: string | null;
    firstSeenAt: Date | null;
  }[],
): Origem[] {
  const mapa = new Map<string, { inscritos: number; compareceram: number }>();

  for (const p of pessoas) {
    const chave = p.utmSource
      ? p.utmCampaign
        ? `${p.utmSource} / ${p.utmCampaign}`
        : p.utmSource
      : (dominio(p.referrer) ?? "direto");

    const atual = mapa.get(chave) ?? { inscritos: 0, compareceram: 0 };
    atual.inscritos += 1;
    if (p.firstSeenAt) atual.compareceram += 1;
    mapa.set(chave, atual);
  }

  return [...mapa.entries()]
    .map(([chave, v]) => ({
      chave,
      inscritos: v.inscritos,
      compareceram: v.compareceram,
      taxa: v.inscritos === 0 ? 0 : (v.compareceram / v.inscritos) * 100,
    }))
    .sort((a, b) => b.inscritos - a.inscritos);
}

/** Uma celula de CSV que nao quebra com virgula, aspas nem quebra de linha. */
export function celulaCsv(valor: unknown): string {
  const v = valor === null || valor === undefined ? "" : String(valor);
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  // BOM para o Excel brasileiro abrir com acento certo
  return (
    "﻿" +
    [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n")
  );
}
