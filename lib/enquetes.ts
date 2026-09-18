import { db } from "./db";

export type EnqueteDaSala = {
  id: string;
  pergunta: string;
  atSec: number;
  untilSec: number | null;
  meuVoto: string | null;
  opcoes: { id: string; label: string }[];
};

/**
 * Todas as enquetes do webinario — sem apuracao.
 *
 * A sala nao mostra resultado nem total, entao o numero nem sai daqui: o
 * navegador do participante nao recebe uma contagem que ele nao veria. Quem
 * ve a apuracao e voce, no painel.
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
    include: { options: { orderBy: { order: "asc" }, select: { id: true, label: true } } },
  });

  return enquetes.map((e) => ({
    id: e.id,
    pergunta: e.question,
    atSec: e.atSec,
    untilSec: e.untilSec,
    meuVoto: null,
    opcoes: e.options.map((o) => ({ id: o.id, label: o.label })),
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
