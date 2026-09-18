import { db } from "./db";

export type EnqueteDaSala = {
  id: string;
  pergunta: string;
  atSec: number;
  untilSec: number | null;
  total: number;
  meuVoto: string | null;
  opcoes: { id: string; label: string; votos: number }[];
};

/**
 * Todas as enquetes do webinario, com a apuracao de agora.
 *
 * Elas viajam com a pagina, como a trilha do chat: a janela de cada uma e
 * deterministica (comeca no segundo X, sai no Y), entao o cliente sabe
 * sozinho qual esta no ar sem perguntar nada. A consulta periodica so
 * atualiza a apuracao e o voto de quem esta assistindo — e por isso a
 * pre-visualizacao, que nao consulta nada, tambem mostra a enquete no minuto
 * certo.
 */
export async function enquetesDoWebinario(webinarId: string): Promise<EnqueteDaSala[]> {
  const enquetes = await db.poll.findMany({
    where: { webinarId },
    orderBy: { atSec: "asc" },
    include: {
      options: { orderBy: { order: "asc" }, include: { _count: { select: { votes: true } } } },
      _count: { select: { votes: true } },
    },
  });

  return enquetes.map((e) => ({
    id: e.id,
    pergunta: e.question,
    atSec: e.atSec,
    untilSec: e.untilSec,
    total: e._count.votes,
    meuVoto: null,
    opcoes: e.options.map((o) => ({ id: o.id, label: o.label, votos: o._count.votes })),
  }));
}

/** A que esta no ar no segundo dado. A mais recente vence, se houver sobreposicao. */
export function enqueteNoAr(enquetes: EnqueteDaSala[], posicaoSec: number): EnqueteDaSala | null {
  let escolhida: EnqueteDaSala | null = null;
  for (const e of enquetes) {
    const noAr = posicaoSec >= e.atSec && (e.untilSec === null || posicaoSec < e.untilSec);
    if (noAr && (!escolhida || e.atSec >= escolhida.atSec)) escolhida = e;
  }
  return escolhida;
}
