"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";

export type EstadoCuradoria = { erro?: string; ok?: string };

/**
 * Acao em lote. Devolve estado em vez de lancar (9.9) e nao se declara
 * feita antes do servidor confirmar (9.6) — quem mostra "liberado" e a
 * tela, depois desta funcao voltar.
 */
export async function mudarStatus(
  webinarId: string,
  status: "APPROVED" | "HIDDEN" | "PENDING",
  ids: string[],
): Promise<EstadoCuradoria> {
  await exigirAdmin();

  if (ids.length === 0) return { erro: "Nenhum comentario selecionado." };

  try {
    const r = await db.chatMessage.updateMany({
      where: { id: { in: ids }, webinarId },
      data: { status },
    });
    revalidatePath(`/painel/w/${webinarId}/curadoria`);
    revalidatePath(`/painel/w/${webinarId}/roteiro`);

    const verbo =
      status === "APPROVED" ? "liberado" : status === "HIDDEN" ? "ocultado" : "devolvido para a fila";
    return { ok: `${r.count} comentario${r.count === 1 ? "" : "s"} ${verbo}${r.count === 1 ? "" : "s"}.` };
  } catch {
    return { erro: "Nao consegui salvar. Tente de novo." };
  }
}

export async function removerComentarios(
  webinarId: string,
  ids: string[],
): Promise<EstadoCuradoria> {
  await exigirAdmin();
  if (ids.length === 0) return { erro: "Nenhum comentario selecionado." };

  try {
    const r = await db.chatMessage.deleteMany({ where: { id: { in: ids }, webinarId } });
    revalidatePath(`/painel/w/${webinarId}/curadoria`);
    return { ok: `${r.count} removido${r.count === 1 ? "" : "s"}.` };
  } catch {
    return { erro: "Nao consegui remover. Tente de novo." };
  }
}
