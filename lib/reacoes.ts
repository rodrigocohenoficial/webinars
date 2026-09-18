import { db } from "./db";

/**
 * Os unicos simbolos aceitos. Lista fechada de proposito: reacao de lista
 * fechada nao precisa de curadoria, porque nao da para ofender ninguem com
 * ela. E o que permite que toda reacao entre no replay automaticamente, sem
 * passar pela sua mao.
 */
export const REACOES = ["🔥", "👏", "❤️", "😮"] as const;
export type Reacao = (typeof REACOES)[number];

export function reacaoValida(valor: unknown): valor is Reacao {
  return typeof valor === "string" && (REACOES as readonly string[]).includes(valor);
}

export type ReacaoNaSala = { id: string; emoji: string; sec: number };

/**
 * Quantas reacoes a trilha carrega, no maximo.
 *
 * Um webinario que roda ha meses acumula dezenas de milhares delas, e mandar
 * tudo para o navegador a cada abertura de sala seria um megabyte de emoji.
 * O teto pega as mais recentes, que e o que mantem a sala parecendo viva sem
 * pesar a pagina.
 */
export const TETO_DA_TRILHA = 1200;

export async function trilhaDeReacoes(webinarId: string): Promise<ReacaoNaSala[]> {
  const linhas = await db.reacao.findMany({
    where: { webinarId },
    orderBy: { createdAt: "desc" },
    take: TETO_DA_TRILHA,
    select: { id: true, emoji: true, videoTimeSec: true },
  });

  return linhas
    .map((r) => ({ id: r.id, emoji: r.emoji, sec: r.videoTimeSec }))
    .sort((a, b) => a.sec - b.sec);
}
